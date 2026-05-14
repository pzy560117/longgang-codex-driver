import { randomUUID } from "node:crypto";
import { type Kysely } from "kysely";
import { CompiledQuery } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import {
  createExportRegistryRepository,
  createExportTaskEventRepository,
  getDatabaseTime
} from "../repositories/index.ts";
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
};

type QueryExecutorResult = SchedulerBatchResult & {
  rows: Record<string, unknown>[];
};

const unsafeKeywordPattern =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|merge|grant|revoke|call|execute)\b/i;
const placeholderPattern = /:([A-Za-z_][A-Za-z0-9_]*)/g;

export function createQueryExecutorBatchProcessor() {
  return async function processQueryBatch(
    context: SchedulerBatchContext
  ): Promise<QueryExecutorResult> {
    const registry = await createExportRegistryRepository(context.db).findRegistryByTaskCode(
      context.task.taskCode
    );
    if (!registry) {
      throw queryError("TASK_NOT_REGISTERED", "registry snapshot is not available");
    }

    if (registry.configSnapshotDigest !== context.task.configSnapshotDigest) {
      throw queryError("QUERY_TEMPLATE_INVALID", "task config snapshot does not match registry");
    }

    const requestSnapshot = parseJson<RequestSnapshot>(
      context.task.requestPayload,
      "QUERY_TEMPLATE_INVALID"
    );
    const authSnapshot = parseJson<AuthSnapshot>(
      context.task.authContextPayload,
      "PERMISSION_DENIED"
    );
    const queryParams = normalizeQueryParams(requestSnapshot.queryParams);
    validateParameterSchema(registry.parameterSchema, queryParams);

    const template = parseQueryTemplate(registry.queryTemplate);
    validateTemplate(template);
    const fieldMappings = parseFieldMappings(registry.fieldMappings);
    const maskingPolicy = parseJson<MaskingPolicy>(registry.maskingPolicy, "MASKING_RULE_ERROR");
    validateMaskingRules(fieldMappings, maskingPolicy);
    const batchSize = positiveInteger(registry.batchSize, 500);
    const cursorField = requireText(registry.cursorField, "QUERY_TEMPLATE_INVALID");
    const orderBy = parseOrderBy(registry.orderBy, cursorField);
    const scope = buildDataScope(authSnapshot);
    const compiled = compileQuery({
      template,
      queryParams,
      authSnapshot,
      scope,
      cursorField,
      lastCursor: context.checkpoint?.lastCursor ?? null,
      orderBy,
      limit: batchSize + 1
    });

    const rawRows = await executeSelect(context.db, compiled.sqlText, compiled.values);
    const limitedRows = rawRows.slice(0, batchSize);
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
      ? String(limitedRows[limitedRows.length - 1]?.[cursorField])
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
      rows: mappedRows,
      checkpoint,
      outcome
    };
  };
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

function validateParameterSchema(
  schemaPayload: string | null,
  queryParams: Record<string, unknown>
): void {
  const schema = parseJson<{
    required?: string[];
    properties?: Record<string, { type?: string }>;
  }>(schemaPayload, "QUERY_TEMPLATE_INVALID");

  for (const required of schema.required ?? []) {
    if (queryParams[required] === undefined || queryParams[required] === null) {
      throw queryError("QUERY_TEMPLATE_INVALID", `required parameter ${required} is missing`);
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
  const orderBy = JSON.parse(value) as Array<{ field?: string; direction?: string }>;
  if (!Array.isArray(orderBy) || orderBy.length === 0) {
    return [{ field: cursorField, direction: "ASC" }];
  }
  return orderBy.map((item) => ({
    field: requireText(item.field, "QUERY_TEMPLATE_INVALID"),
    direction: item.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC"
  }));
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
  cursorField: string;
  lastCursor: string | null;
  orderBy: Array<{ field: string; direction: "ASC" | "DESC" }>;
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

  const cursorSql = input.lastCursor ? ` AND ${quoteIdentifier(input.cursorField)} > ?` : "";
  if (input.lastCursor) {
    values.push(input.lastCursor);
  }

  const orderSql = input.orderBy
    .map((item) => `${quoteIdentifier(item.field)} ${item.direction}`)
    .join(", ");
  values.push(input.limit);

  return {
    sqlText: `SELECT * FROM (${sqlText}) AS export_query WHERE ${dataScopeSql}${cursorSql} ORDER BY ${orderSql} LIMIT ?`,
    values
  };
}

async function executeSelect(
  db: Kysely<ExportPlatformDatabase>,
  sqlText: string,
  values: unknown[]
): Promise<Record<string, unknown>[]> {
  const result = await db.executeQuery<Record<string, unknown>>(
    CompiledQuery.raw(sqlText, values)
  );
  return result.rows as Record<string, unknown>[];
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
    if (!rule || rule.type !== "PHONE") {
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
  if (rule.type !== "PHONE") {
    throw queryError("MASKING_RULE_ERROR", `masking rule ${ruleCode} is not supported`);
  }

  const text = String(value ?? "");
  const prefix = rule.preservePrefix ?? 3;
  const suffix = rule.preserveSuffix ?? 4;
  if (text.length <= prefix + suffix) {
    return "*".repeat(text.length);
  }
  return `${text.slice(0, prefix)}${"*".repeat(text.length - prefix - suffix)}${text.slice(-suffix)}`;
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
