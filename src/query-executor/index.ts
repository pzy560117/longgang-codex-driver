import { randomUUID } from "node:crypto";
import { type Kysely } from "kysely";
import { CompiledQuery } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import {
  createExportRegistryRepository,
  createExportTaskEventRepository,
  getDatabaseTime,
  type ExportRegistryRecord
} from "../repositories/index.ts";
import { assertSamplePurchaseOrderRegistryContract } from "../sample-purchase-order/index.ts";
import type {
  SchedulerBatchContext,
  SchedulerBatchResult
} from "../scheduler/worker.ts";

type QueryTemplate = {
  queryTemplateVersion?: string;
  templateText: string;
  allowedParameters?: string[];
};

type FieldMapping = {
  fieldCode: string;
  headerName: string;
  orderNo: number;
  sensitive?: boolean;
  exportable?: boolean;
  maskingRuleCode?: string;
};

type MaskingPolicy = {
  rules?: Record<
    string,
    {
      type: string;
      preservePrefix?: number;
      preserveSuffix?: number;
    }
  >;
};

type AuthSnapshot = {
  operatorId?: string;
  tenantId?: string;
  roleCodes?: string[];
  orgScope?: string[] | string;
  requestId?: string;
};

type RequestSnapshot = {
  queryParams?: Record<string, unknown>;
  configSnapshot?: ExportRegistryRecord;
};

type ParameterSchemaDefinition = {
  type?: string;
};

type ParameterSchema = {
  type?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, ParameterSchemaDefinition>;
};

type OrderByDefinition = {
  field: string;
  direction: "ASC" | "DESC";
};

type CursorToken = {
  version: 1;
  values: Record<string, string | number | boolean | null>;
};

type QueryExecutorResult = SchedulerBatchResult & {
  rows: Record<string, unknown>[];
  registry: ExportRegistryRecord;
};

const unsafeKeywordPattern =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|grant|revoke|call|execute)\b/i;
const placeholderPattern = /:([A-Za-z_][A-Za-z0-9_]*)/g;

export function createQueryExecutorBatchProcessor() {
  return async function processQueryBatch(
    context: SchedulerBatchContext
  ): Promise<QueryExecutorResult> {
    const requestSnapshot = parseJson<RequestSnapshot>(
      context.task.requestPayload,
      "QUERY_TEMPLATE_INVALID"
    );
    const registry = await resolveTaskRegistrySnapshot(context, requestSnapshot);
    if (!registry) {
      throw queryError("TASK_NOT_REGISTERED", "registry snapshot is not available");
    }

    if (registry.configSnapshotDigest !== context.task.configSnapshotDigest) {
      throw queryError("QUERY_TEMPLATE_INVALID", "task config snapshot does not match registry");
    }

    const authSnapshot = parseJson<AuthSnapshot>(
      context.task.authContextPayload,
      "PERMISSION_DENIED"
    );
    assertSamplePurchaseOrderRegistryContract({
      taskCode: registry.taskCode,
      subsystemCode: registry.subsystemCode,
      singleFileMaxRows: registry.singleFileMaxRows,
      exportMaxRows: registry.exportMaxRows,
      supportedFormats: registry.supportedFormats,
      parameterSchema: registry.parameterSchema,
      queryTemplate: registry.queryTemplate,
      fieldMappings: registry.fieldMappings,
      maskingPolicy: registry.maskingPolicy,
      cursorField: registry.cursorField,
      orderBy: registry.orderBy
    });
    const queryParams = normalizeQueryParams(requestSnapshot.queryParams);
    const parameterSchema = parseParameterSchema(registry.parameterSchema);
    validateParameterSchema(parameterSchema, queryParams);

    const template = parseQueryTemplate(registry.queryTemplate);
    validateTemplate(template);
    const fieldMappings = parseFieldMappings(registry.fieldMappings);
    const maskingPolicy = parseJson<MaskingPolicy>(registry.maskingPolicy, "MASKING_RULE_ERROR");
    validateMaskingRules(fieldMappings, maskingPolicy);
    const batchSize = positiveInteger(registry.batchSize, 500);
    const cursorField = requireText(registry.cursorField, "QUERY_TEMPLATE_INVALID");
    const orderBy = parseOrderBy(registry.orderBy, cursorField);
    const scope = buildDataScope(authSnapshot);
    const cursorToken = decodeCursorToken(context.checkpoint?.lastCursor ?? null, orderBy);
    const compiled = compileQuery({
      template,
      queryParams,
      authSnapshot,
      scope,
      lastCursor: cursorToken,
      orderBy,
      limit: batchSize + 1
    });

    const rawRows = await executeSelect(context.db, compiled.sqlText, compiled.values);
    const limitedRows = rawRows.slice(0, batchSize);
    validateCursorRows(limitedRows, orderBy, cursorToken);
    const mappedRows = mapRows({
      rows: limitedRows,
      mappings: fieldMappings,
      maskingPolicy
    });
    const processedCount = (context.checkpoint?.processedCount ?? 0) + mappedRows.length;

    if (processedCount > registry.exportMaxRows) {
      throw queryError("EXPORT_LIMIT_EXCEEDED", "query result exceeds registry exportMaxRows");
    }

    const now = await getDatabaseTime(context.db);
    const batchEventTime = new Date(now.getTime() + 1);
    const lastCursor = limitedRows.length
      ? encodeCursorToken(createCursorToken(limitedRows[limitedRows.length - 1], orderBy))
      : context.checkpoint?.lastCursor ?? null;
    const checkpoint = {
      lastCursor,
      processedCount,
      filePartNo: context.checkpoint?.filePartNo ?? 1,
      retryCount: context.checkpoint?.retryCount ?? 0,
      batchSize,
      batchRowCount: mappedRows.length,
      backoffMs: 0
    };
    const outcome = rawRows.length <= batchSize ? "completed" : "continue";
    const rows =
      outcome === "completed" && (context.checkpoint?.processedCount ?? 0) > 0
        ? await collectCompletedRows({
            db: context.db,
            template,
            queryParams,
            scope,
            orderBy,
            batchSize,
            fieldMappings,
            maskingPolicy,
            expectedCount: processedCount,
            exportMaxRows: registry.exportMaxRows
          })
        : mappedRows;

    await appendQueryEvent({
      context,
      eventType: "QUERY_READY",
      datasourceCode: registry.datasourceCode,
      queryTemplateVersion: template.queryTemplateVersion ?? context.task.configSnapshotDigest,
      batchCheckpoint: {
        taskId: context.task.taskId,
        attemptNo: context.lease.attemptNo,
        requestId: context.requestId,
        datasourceCode: registry.datasourceCode,
        queryTemplateVersion: template.queryTemplateVersion ?? null
      },
      now
    });

    await appendQueryEvent({
      context,
      eventType: "QUERY_BATCH_DONE",
      datasourceCode: registry.datasourceCode,
      queryTemplateVersion: template.queryTemplateVersion ?? context.task.configSnapshotDigest,
      batchCheckpoint: checkpoint,
      now: batchEventTime
    });

    return {
      rows,
      checkpoint,
      outcome,
      registry
    };
  };
}

async function resolveTaskRegistrySnapshot(
  context: SchedulerBatchContext,
  requestSnapshot: RequestSnapshot
): Promise<ExportRegistryRecord | undefined> {
  if (
    requestSnapshot.configSnapshot &&
    requestSnapshot.configSnapshot.configSnapshotDigest === context.task.configSnapshotDigest
  ) {
    return requestSnapshot.configSnapshot;
  }

  return createExportRegistryRepository(context.db).findRegistryByTaskCode(context.task.taskCode);
}

function parseJson<T>(value: string | null | undefined, code: string): T {
  if (!value) {
    throw queryError(code, "required JSON snapshot is missing");
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    throw queryError(code, "required JSON snapshot is invalid");
  }
}

function normalizeQueryParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseParameterSchema(schemaPayload: string | null): ParameterSchema {
  const schema = parseJson<ParameterSchema>(schemaPayload, "QUERY_TEMPLATE_INVALID");
  if (schema.type && schema.type !== "object") {
    throw queryError("QUERY_TEMPLATE_INVALID", "parameter schema must describe an object");
  }
  return schema;
}

function validateParameterSchema(
  schema: ParameterSchema,
  queryParams: Record<string, unknown>
): void {
  for (const required of schema.required ?? []) {
    if (queryParams[required] === undefined || queryParams[required] === null) {
      throw queryError("QUERY_TEMPLATE_INVALID", `required parameter ${required} is missing`);
    }
  }

  const allowedKeys = new Set(Object.keys(schema.properties ?? {}));
  for (const key of Object.keys(queryParams)) {
    if (allowedKeys.size > 0 && !allowedKeys.has(key)) {
      throw queryError("QUERY_TEMPLATE_INVALID", `parameter ${key} is not declared`);
    }
  }

  for (const [key, definition] of Object.entries(schema.properties ?? {})) {
    const value = queryParams[key];
    if (value === undefined || value === null || !definition.type) {
      continue;
    }
    if (definition.type === "string" && typeof value !== "string") {
      throw queryError("QUERY_TEMPLATE_INVALID", `parameter ${key} must be a string`);
    }
  }
}

function parseQueryTemplate(value: string | null): QueryTemplate {
  const template = parseJson<QueryTemplate>(value, "QUERY_TEMPLATE_INVALID");
  if (!template.templateText || typeof template.templateText !== "string") {
    throw queryError("QUERY_TEMPLATE_INVALID", "query template text is required");
  }
  return template;
}

function validateTemplate(template: QueryTemplate): void {
  const normalized = template.templateText.trim();
  if (!/^select\b/i.test(normalized)) {
    throw queryError("QUERY_TEMPLATE_INVALID", "query template must be a SELECT statement");
  }
  if (normalized.includes(";") || unsafeKeywordPattern.test(normalized)) {
    throw queryError("QUERY_TEMPLATE_INVALID", "query template contains unsafe SQL");
  }

  const allowed = new Set(template.allowedParameters ?? []);
  for (const placeholder of extractPlaceholders(normalized)) {
    if (!allowed.has(placeholder) && !["tenantId", "orgScope"].includes(placeholder)) {
      throw queryError("QUERY_TEMPLATE_INVALID", `placeholder ${placeholder} is not declared`);
    }
  }
}

function parseFieldMappings(value: string | null): FieldMapping[] {
  const mappings = parseJson<FieldMapping[]>(value, "FIELD_MAPPING_INVALID");
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw queryError("FIELD_MAPPING_INVALID", "field mappings are required");
  }
  return mappings
    .filter((mapping) => mapping.exportable !== false)
    .sort((left, right) => left.orderNo - right.orderNo);
}

function parseOrderBy(value: string | null, cursorField: string): Array<{
  field: string;
  direction: "ASC" | "DESC";
}> {
  if (!value) {
    return [{ field: cursorField, direction: "ASC" }];
  }
  let orderBy: Array<{ field?: string; direction?: string }>;
  try {
    orderBy = JSON.parse(value) as Array<{ field?: string; direction?: string }>;
  } catch {
    throw queryError("QUERY_TEMPLATE_INVALID", "orderBy must be valid JSON");
  }
  if (!Array.isArray(orderBy) || orderBy.length === 0) {
    return [{ field: cursorField, direction: "ASC" }];
  }
  const normalized: OrderByDefinition[] = orderBy.map((item) => ({
    field: requireText(item.field, "QUERY_TEMPLATE_INVALID"),
    direction: item.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC"
  }));
  if (!normalized.some((item) => item.field === cursorField)) {
    normalized.push({ field: cursorField, direction: "ASC" });
  }
  return dedupeOrderBy(normalized);
}

function buildDataScope(auth: AuthSnapshot): { tenantId: string; orgScope: string[] } {
  const tenantId = requireText(auth.tenantId, "PERMISSION_DENIED");
  const orgScope = Array.isArray(auth.orgScope)
    ? auth.orgScope
    : typeof auth.orgScope === "string"
      ? auth.orgScope.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  if (orgScope.length === 0) {
    throw queryError("PERMISSION_DENIED", "auth orgScope is required");
  }
  return { tenantId, orgScope };
}

function compileQuery(input: {
  template: QueryTemplate;
  queryParams: Record<string, unknown>;
  authSnapshot: AuthSnapshot;
  scope: { tenantId: string; orgScope: string[] };
  lastCursor: CursorToken | null;
  orderBy: OrderByDefinition[];
  limit: number;
}): { sqlText: string; values: unknown[] } {
  const values: unknown[] = [];
  const sqlText = input.template.templateText.replace(
    placeholderPattern,
    (_match, name: string) => {
      if (name === "orgScope") {
        values.push(...input.scope.orgScope);
        return parameterList(input.scope.orgScope.length);
      }
      if (name === "tenantId") {
        values.push(input.scope.tenantId);
        return "?";
      }
      const value = input.queryParams[name] ?? null;
      values.push(name === "keyword" && typeof value === "string" ? `%${value}%` : value);
      return "?";
    }
  );

  const dataScopeSql = `tenantId = ? AND orgId IN (${parameterList(input.scope.orgScope.length)})`;
  values.push(input.scope.tenantId, ...input.scope.orgScope);

  const cursorPredicate = buildCursorPredicate(input.orderBy, input.lastCursor);
  values.push(...cursorPredicate.values);

  const orderSql = input.orderBy
    .map((item) => `${quoteIdentifier(item.field)} ${item.direction}`)
    .join(", ");
  values.push(input.limit);

  return {
    sqlText: `SELECT * FROM (${sqlText}) AS export_query WHERE ${dataScopeSql}${cursorPredicate.sql} ORDER BY ${orderSql} LIMIT ?`,
    values
  };
}

async function executeSelect(
  db: Kysely<ExportPlatformDatabase>,
  sqlText: string,
  values: unknown[]
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.executeQuery<Record<string, unknown>>(
      CompiledQuery.raw(sqlText, values)
    );
    return result.rows as Record<string, unknown>[];
  } catch (error) {
    throw mapDatasourceAdapterError(error);
  }
}

async function collectCompletedRows(input: {
  db: Kysely<ExportPlatformDatabase>;
  template: QueryTemplate;
  queryParams: Record<string, unknown>;
  scope: { tenantId: string; orgScope: string[] };
  orderBy: OrderByDefinition[];
  batchSize: number;
  fieldMappings: FieldMapping[];
  maskingPolicy: MaskingPolicy;
  expectedCount: number;
  exportMaxRows: number;
}): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursorToken: CursorToken | null = null;

  while (rows.length < input.expectedCount) {
    const compiled = compileQuery({
      template: input.template,
      queryParams: input.queryParams,
      authSnapshot: {},
      scope: input.scope,
      lastCursor: cursorToken,
      orderBy: input.orderBy,
      limit: input.batchSize + 1
    });
    const rawRows = await executeSelect(input.db, compiled.sqlText, compiled.values);
    const limitedRows = rawRows.slice(0, input.batchSize);
    validateCursorRows(limitedRows, input.orderBy, cursorToken);

    if (limitedRows.length === 0) {
      break;
    }

    rows.push(
      ...mapRows({
        rows: limitedRows,
        mappings: input.fieldMappings,
        maskingPolicy: input.maskingPolicy
      })
    );
    if (rows.length > input.exportMaxRows) {
      throw queryError("EXPORT_LIMIT_EXCEEDED", "query result exceeds registry exportMaxRows");
    }

    cursorToken = createCursorToken(limitedRows[limitedRows.length - 1], input.orderBy);
    if (rawRows.length <= input.batchSize) {
      break;
    }
  }

  if (rows.length !== input.expectedCount) {
    throw queryError(
      "QUERY_EXECUTION_ERROR",
      `completed batch reconstruction mismatch: expected ${input.expectedCount} rows, got ${rows.length}`
    );
  }

  return rows;
}

function mapRows(input: {
  rows: Record<string, unknown>[];
  mappings: FieldMapping[];
  maskingPolicy: MaskingPolicy;
}): Record<string, unknown>[] {
  return input.rows.map((row) => {
    const output: Record<string, unknown> = {};
    for (const mapping of input.mappings) {
      if (!(mapping.fieldCode in row)) {
        throw queryError("FIELD_MAPPING_INVALID", `field ${mapping.fieldCode} is not selected`);
      }
      const rawValue = row[mapping.fieldCode];
      output[mapping.headerName] = mapping.sensitive
        ? maskValue(rawValue, mapping, input.maskingPolicy)
        : rawValue;
    }
    return output;
  });
}

function validateMaskingRules(mappings: FieldMapping[], maskingPolicy: MaskingPolicy): void {
  for (const mapping of mappings) {
    if (!mapping.sensitive) {
      continue;
    }
    const ruleCode = mapping.maskingRuleCode;
    const rule = ruleCode ? maskingPolicy.rules?.[ruleCode] : undefined;
    if (!rule || !["PHONE", "PERSON_NAME"].includes(rule.type)) {
      throw queryError("MASKING_RULE_ERROR", `masking rule ${ruleCode ?? ""} is missing`);
    }
  }
}

function maskValue(
  value: unknown,
  mapping: FieldMapping,
  maskingPolicy: MaskingPolicy
): unknown {
  const ruleCode = mapping.maskingRuleCode;
  const rule = ruleCode ? maskingPolicy.rules?.[ruleCode] : undefined;
  if (!rule) {
    throw queryError("MASKING_RULE_ERROR", `masking rule ${ruleCode ?? ""} is missing`);
  }
  const text = String(value ?? "");
  if (rule.type === "PHONE") {
    const prefix = rule.preservePrefix ?? 3;
    const suffix = rule.preserveSuffix ?? 4;
    if (text.length <= prefix + suffix) {
      return "*".repeat(text.length);
    }
    return `${text.slice(0, prefix)}${"*".repeat(text.length - prefix - suffix)}${text.slice(-suffix)}`;
  }
  if (rule.type === "PERSON_NAME") {
    if (text.length <= 1) {
      return "*";
    }
    if (text.length === 2) {
      return `${text.slice(0, 1)}*`;
    }
    return `${text.slice(0, 1)}${"*".repeat(text.length - 2)}${text.slice(-1)}`;
  }
  throw queryError("MASKING_RULE_ERROR", `masking rule ${ruleCode} is not supported`);
}

async function appendQueryEvent(input: {
  context: SchedulerBatchContext;
  eventType: string;
  datasourceCode: string;
  queryTemplateVersion: string;
  batchCheckpoint: unknown;
  now: Date;
}): Promise<void> {
  await createExportTaskEventRepository(input.context.db).appendTaskEvent({
    eventId: `event_${randomUUID()}`,
    taskId: input.context.task.taskId,
    attemptNo: input.context.lease.attemptNo,
    eventType: input.eventType,
    requestId: input.context.requestId,
    datasourceCode: input.datasourceCode,
    queryTemplateVersion: input.queryTemplateVersion,
    batchCheckpoint: JSON.stringify(input.batchCheckpoint),
    occurredAt: input.now,
    now: input.now
  });
}

function extractPlaceholders(templateText: string): string[] {
  return [...templateText.matchAll(placeholderPattern)].map((match) => match[1]);
}

function dedupeOrderBy(orderBy: OrderByDefinition[]): OrderByDefinition[] {
  const seen = new Set<string>();
  const normalized: OrderByDefinition[] = [];
  for (const item of orderBy) {
    if (seen.has(item.field)) {
      continue;
    }
    seen.add(item.field);
    normalized.push(item);
  }
  return normalized;
}

function decodeCursorToken(
  lastCursor: string | null,
  orderBy: OrderByDefinition[]
): CursorToken | null {
  if (!lastCursor) {
    return null;
  }
  try {
    const parsed = JSON.parse(lastCursor) as CursorToken;
    if (parsed?.version === 1 && parsed.values && typeof parsed.values === "object") {
      return parsed;
    }
  } catch {
    // Older checkpoints only persist the terminal cursor field value.
  }
  return {
    version: 1,
    values: {
      [orderBy[orderBy.length - 1].field]: lastCursor
    }
  };
}

function encodeCursorToken(token: CursorToken): string {
  return JSON.stringify(token);
}

function createCursorToken(row: Record<string, unknown>, orderBy: OrderByDefinition[]): CursorToken {
  const values: CursorToken["values"] = {};
  for (const item of orderBy) {
    values[item.field] = normalizeCursorValue(row[item.field], item.field);
  }
  return { version: 1, values };
}

function buildCursorPredicate(
  orderBy: OrderByDefinition[],
  lastCursor: CursorToken | null
): { sql: string; values: Array<string | number | boolean | null> } {
  if (!lastCursor) {
    return { sql: "", values: [] };
  }

  const clauses: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  for (let index = 0; index < orderBy.length; index += 1) {
    const andParts: string[] = [];
    for (let prefixIndex = 0; prefixIndex < index; prefixIndex += 1) {
      const prefixField = orderBy[prefixIndex].field;
      andParts.push(`${quoteIdentifier(prefixField)} = ?`);
      values.push(readCursorField(lastCursor, prefixField));
    }
    const field = orderBy[index].field;
    andParts.push(
      `${quoteIdentifier(field)} ${orderBy[index].direction === "DESC" ? "<" : ">"} ?`
    );
    values.push(readCursorField(lastCursor, field));
    clauses.push(`(${andParts.join(" AND ")})`);
  }

  return {
    sql: ` AND (${clauses.join(" OR ")})`,
    values
  };
}

function readCursorField(
  token: CursorToken,
  field: string
): string | number | boolean | null {
  if (!(field in token.values)) {
    throw queryExecutionError(`cursor field ${field} is missing from checkpoint`);
  }
  return token.values[field] ?? null;
}

function validateCursorRows(
  rows: Record<string, unknown>[],
  orderBy: OrderByDefinition[],
  lastCursor: CursorToken | null
): void {
  let previous = lastCursor;
  for (const row of rows) {
    const current = createCursorToken(row, orderBy);
    if (previous && compareCursorTokens(previous, current, orderBy) >= 0) {
      throw queryExecutionError("cursor values are duplicate or non-increasing");
    }
    previous = current;
  }
}

function compareCursorTokens(
  left: CursorToken,
  right: CursorToken,
  orderBy: OrderByDefinition[]
): number {
  for (const item of orderBy) {
    const leftValue = readCursorField(left, item.field);
    const rightValue = readCursorField(right, item.field);
    const comparison = compareCursorValues(leftValue, rightValue);
    if (comparison === 0) {
      continue;
    }
    return item.direction === "DESC" ? comparison * -1 : comparison;
  }
  return 0;
}

function compareCursorValues(
  left: string | number | boolean | null,
  right: string | number | boolean | null
): number {
  if (left === right) {
    return 0;
  }
  if (left === null || right === null) {
    throw queryExecutionError("cursor field is missing or null");
  }
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : 1;
  }
  const leftText = String(left);
  const rightText = String(right);
  return leftText.localeCompare(rightText);
}

function normalizeCursorValue(
  value: unknown,
  field: string
): string | number | boolean | null {
  if (value === null || value === undefined) {
    throw queryExecutionError(`cursor field ${field} is missing`);
  }
  if (value instanceof Date) {
    return toDatabaseDateTimeLiteral(value);
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return JSON.stringify(value);
}

function toDatabaseDateTimeLiteral(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  const milliseconds = String(value.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function positiveInteger(value: number | null | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function requireText(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw queryError(code, "required text value is missing");
  }
  return value;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw queryError("QUERY_TEMPLATE_INVALID", `unsafe identifier ${identifier}`);
  }
  return `\`${identifier}\``;
}

function parameterList(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function queryError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  error.name = code;
  return error;
}

function queryExecutionError(message: string): Error {
  return queryError("QUERY_EXECUTION_ERROR", message);
}

export function mapDatasourceAdapterError(error: unknown): Error {
  const code = readErrorCode(error);
  if (
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "ETIMEDOUT",
      "EHOSTUNREACH",
      "PROTOCOL_CONNECTION_LOST",
      "ER_ACCESS_DENIED_ERROR",
      "ER_DBACCESS_DENIED_ERROR",
      "ER_ACCESS_DENIED_NO_PASSWORD_ERROR",
      "ER_CON_COUNT_ERROR"
    ].includes(code)
  ) {
    return queryError(
      "DATASOURCE_UNAVAILABLE",
      error instanceof Error ? error.message : "datasource unavailable"
    );
  }

  if (error instanceof Error && error.name !== "Error") {
    return error;
  }

  return queryExecutionError(error instanceof Error ? error.message : "query execution failed");
}

function readErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}
