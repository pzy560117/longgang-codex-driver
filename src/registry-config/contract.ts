import { createHash } from "node:crypto";
import { ApiError } from "../audit-log/auth-context.ts";
import type { ExportRegistryUpsertInput } from "../repositories/index.ts";

export type RegistryBody = {
  taskCode?: unknown;
  subsystemCode?: unknown;
  displayName?: unknown;
  enabled?: unknown;
  concurrencyLimit?: unknown;
  fileRetentionDays?: unknown;
  taskHistoryRetentionDays?: unknown;
  singleFileMaxRows?: unknown;
  exportMaxRows?: unknown;
  supportedFormats?: unknown;
  datasourceCode?: unknown;
  parameterSchema?: unknown;
  queryTemplate?: unknown;
  fieldMappings?: unknown;
  maskingPolicy?: unknown;
  dataScopeTemplate?: unknown;
  cursorField?: unknown;
  orderBy?: unknown;
  batchSize?: unknown;
};

export const REGISTRY_REQUIRED_FIELDS = [
  "taskCode",
  "subsystemCode",
  "displayName",
  "enabled",
  "concurrencyLimit",
  "fileRetentionDays",
  "taskHistoryRetentionDays",
  "singleFileMaxRows",
  "exportMaxRows",
  "supportedFormats",
  "datasourceCode",
  "parameterSchema",
  "queryTemplate",
  "fieldMappings",
  "maskingPolicy",
  "dataScopeTemplate",
  "cursorField",
  "orderBy",
  "batchSize"
] as const;

export const QUERY_TEMPLATE_REQUIRED_FIELDS = [
  "queryTemplateVersion",
  "templateText",
  "allowedParameters"
] as const;

export const FIELD_MAPPING_REQUIRED_FIELDS = [
  "fieldCode",
  "headerName",
  "fieldType",
  "orderNo",
  "sensitive",
  "exportable"
] as const;

export const ORDER_BY_REQUIRED_FIELDS = ["field", "direction"] as const;

export const REGISTRY_REQUIRED_FIELD_ERROR_CODES = {
  taskCode: "QUERY_TEMPLATE_INVALID",
  subsystemCode: "QUERY_TEMPLATE_INVALID",
  displayName: "QUERY_TEMPLATE_INVALID",
  enabled: "QUERY_TEMPLATE_INVALID",
  concurrencyLimit: "QUERY_TEMPLATE_INVALID",
  fileRetentionDays: "QUERY_TEMPLATE_INVALID",
  taskHistoryRetentionDays: "QUERY_TEMPLATE_INVALID",
  singleFileMaxRows: "QUERY_TEMPLATE_INVALID",
  exportMaxRows: "QUERY_TEMPLATE_INVALID",
  supportedFormats: "QUERY_TEMPLATE_INVALID",
  datasourceCode: "QUERY_TEMPLATE_INVALID",
  parameterSchema: "QUERY_TEMPLATE_INVALID",
  queryTemplate: "QUERY_TEMPLATE_INVALID",
  fieldMappings: "FIELD_MAPPING_INVALID",
  maskingPolicy: "MASKING_RULE_ERROR",
  dataScopeTemplate: "QUERY_TEMPLATE_INVALID",
  cursorField: "QUERY_TEMPLATE_INVALID",
  orderBy: "QUERY_TEMPLATE_INVALID",
  batchSize: "QUERY_TEMPLATE_INVALID"
} as const;

const FILE_FORMATS = new Set(["XLSX", "ZIP"]);
const FIELD_TYPES = new Set(["STRING", "NUMBER", "DECIMAL", "DATETIME", "DATE", "BOOLEAN"]);
const ORDER_DIRECTIONS = new Set(["ASC", "DESC"]);
export const SUPPORTED_MASKING_RULE_TYPES = ["PHONE", "PERSON_NAME"] as const;
const MASKING_RULE_TYPES = new Set<string>(SUPPORTED_MASKING_RULE_TYPES);

type ValidatedQueryTemplate = {
  queryTemplateVersion: string;
  templateText: string;
  allowedParameters: string[];
};

type ValidatedFieldMapping = {
  fieldCode: string;
  headerName: string;
  fieldType: string;
  orderNo: number;
  sensitive: boolean;
  exportable: boolean;
  maskingRuleCode?: string;
};

type ValidatedOrderBy = {
  field: string;
  direction: "ASC" | "DESC";
};

type ValidatedRegistryContract = {
  taskCode: string;
  subsystemCode: string;
  displayName: string;
  enabled: boolean;
  concurrencyLimit: number;
  fileRetentionDays: number;
  taskHistoryRetentionDays: number;
  singleFileMaxRows: number;
  exportMaxRows: number;
  supportedFormats: string[];
  datasourceCode: string;
  parameterSchema: Record<string, unknown>;
  queryTemplate: ValidatedQueryTemplate;
  fieldMappings: ValidatedFieldMapping[];
  maskingPolicy: Record<string, unknown>;
  dataScopeTemplate: string;
  cursorField: string;
  orderBy: ValidatedOrderBy[];
  batchSize: number;
};

export function buildValidatedRegistryUpsertInput(input: {
  body: RegistryBody;
  now: Date;
  taskCodeOverride?: string;
}): ExportRegistryUpsertInput {
  const contract = validateExportRegistryContract(input.body, input.taskCodeOverride);
  const parameterSchemaDigest = digest(contract.parameterSchema);
  const fieldMappingDigest = digest(contract.fieldMappings);
  const maskingPolicyDigest = digest(contract.maskingPolicy);
  const configSnapshotDigest = digest({
    taskCode: contract.taskCode,
    parameterSchemaDigest,
    fieldMappingDigest,
    maskingPolicyDigest,
    queryTemplate: contract.queryTemplate,
    dataScopeTemplate: contract.dataScopeTemplate,
    cursorField: contract.cursorField,
    orderBy: contract.orderBy,
    batchSize: contract.batchSize
  });

  return {
    taskCode: contract.taskCode,
    subsystemCode: contract.subsystemCode,
    displayName: contract.displayName,
    enabled: contract.enabled,
    concurrencyLimit: contract.concurrencyLimit,
    fileRetentionDays: contract.fileRetentionDays,
    taskHistoryRetentionDays: contract.taskHistoryRetentionDays,
    singleFileMaxRows: contract.singleFileMaxRows,
    exportMaxRows: contract.exportMaxRows,
    datasourceCode: contract.datasourceCode,
    supportedFormats: stableText(contract.supportedFormats),
    parameterSchema: stableText(contract.parameterSchema),
    queryTemplate: stableText(contract.queryTemplate),
    fieldMappings: stableText(contract.fieldMappings),
    maskingPolicy: stableText(contract.maskingPolicy),
    dataScopeTemplate: contract.dataScopeTemplate,
    cursorField: contract.cursorField,
    orderBy: stableText(contract.orderBy),
    batchSize: contract.batchSize,
    configSnapshotDigest,
    parameterSchemaDigest,
    fieldMappingDigest,
    maskingPolicyDigest,
    now: input.now
  };
}

export function validateExportRegistryContract(
  body: RegistryBody,
  taskCodeOverride?: string
): ValidatedRegistryContract {
  const taskCode = requireTaskCode(body.taskCode, taskCodeOverride);
  const fieldMappings = requireFieldMappings(body.fieldMappings);
  const maskingPolicy = requireRecord("maskingPolicy", body.maskingPolicy, "MASKING_RULE_ERROR");
  validateMaskingContract(fieldMappings, maskingPolicy);

  return {
    taskCode,
    subsystemCode: requireNonEmptyString("subsystemCode", body.subsystemCode),
    displayName: requireNonEmptyString("displayName", body.displayName),
    enabled: requireBoolean("enabled", body.enabled),
    concurrencyLimit: requirePositiveInteger("concurrencyLimit", body.concurrencyLimit),
    fileRetentionDays: requirePositiveInteger("fileRetentionDays", body.fileRetentionDays),
    taskHistoryRetentionDays: requirePositiveInteger(
      "taskHistoryRetentionDays",
      body.taskHistoryRetentionDays
    ),
    singleFileMaxRows: requirePositiveInteger("singleFileMaxRows", body.singleFileMaxRows),
    exportMaxRows: requirePositiveInteger("exportMaxRows", body.exportMaxRows),
    supportedFormats: requireSupportedFormats(body.supportedFormats),
    datasourceCode: requireNonEmptyString("datasourceCode", body.datasourceCode),
    parameterSchema: requireRecord("parameterSchema", body.parameterSchema),
    queryTemplate: requireQueryTemplate(body.queryTemplate),
    fieldMappings,
    maskingPolicy,
    dataScopeTemplate: requireNonEmptyString("dataScopeTemplate", body.dataScopeTemplate),
    cursorField: requireNonEmptyString("cursorField", body.cursorField),
    orderBy: requireOrderBy(body.orderBy),
    batchSize: requirePositiveInteger("batchSize", body.batchSize)
  };
}

function validateMaskingContract(
  fieldMappings: ValidatedFieldMapping[],
  maskingPolicy: Record<string, unknown>
): void {
  const rules = maskingPolicy.rules;
  for (const mapping of fieldMappings) {
    if (!mapping.exportable || !mapping.sensitive) {
      continue;
    }
    if (!mapping.maskingRuleCode) {
      throw new ApiError(400, "MASKING_RULE_ERROR", `${mapping.fieldCode} maskingRuleCode is required`);
    }
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
      throw new ApiError(400, "MASKING_RULE_ERROR", "maskingPolicy.rules is required");
    }
    const rule = (rules as Record<string, unknown>)[mapping.maskingRuleCode];
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new ApiError(400, "MASKING_RULE_ERROR", `${mapping.maskingRuleCode} masking rule is required`);
    }
    const ruleType = (rule as Record<string, unknown>).type;
    if (typeof ruleType !== "string" || !MASKING_RULE_TYPES.has(ruleType)) {
      throw new ApiError(400, "MASKING_RULE_ERROR", `${mapping.maskingRuleCode} masking rule is not supported`);
    }
  }
}

function stableText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableText(value)).digest("hex")}`;
}

function requireTaskCode(value: unknown, taskCodeOverride?: string): string {
  const taskCode = requireNonEmptyString("taskCode", value);
  if (taskCodeOverride && taskCodeOverride !== taskCode) {
    throw new ApiError(400, "QUERY_TEMPLATE_INVALID", "taskCode in body must match route taskCode");
  }
  return taskCodeOverride ?? taskCode;
}

function requireNonEmptyString(
  field: keyof typeof REGISTRY_REQUIRED_FIELD_ERROR_CODES,
  value: unknown,
  code = REGISTRY_REQUIRED_FIELD_ERROR_CODES[field]
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, code, `${field} is required`);
  }
  return value;
}

function requireBoolean(field: "enabled", value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ApiError(400, REGISTRY_REQUIRED_FIELD_ERROR_CODES[field], `${field} is required`);
  }
  return value;
}

function requirePositiveInteger(
  field:
    | "concurrencyLimit"
    | "fileRetentionDays"
    | "taskHistoryRetentionDays"
    | "singleFileMaxRows"
    | "exportMaxRows"
    | "batchSize",
  value: unknown
): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ApiError(400, REGISTRY_REQUIRED_FIELD_ERROR_CODES[field], `${field} must be >= 1`);
  }
  return Number(value);
}

function requireSupportedFormats(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "QUERY_TEMPLATE_INVALID", "supportedFormats is required");
  }
  return value.map((item) => {
    if (typeof item !== "string" || !FILE_FORMATS.has(item)) {
      throw new ApiError(400, "QUERY_TEMPLATE_INVALID", "supportedFormats contains an unsupported format");
    }
    return item;
  });
}

function requireRecord(
  field: "parameterSchema" | "maskingPolicy",
  value: unknown,
  code = REGISTRY_REQUIRED_FIELD_ERROR_CODES[field]
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, code, `${field} is required`);
  }
  return value as Record<string, unknown>;
}

function requireQueryTemplate(value: unknown): ValidatedQueryTemplate {
  const queryTemplate = requireObjectWithKeys(
    "queryTemplate",
    value,
    QUERY_TEMPLATE_REQUIRED_FIELDS,
    "QUERY_TEMPLATE_INVALID"
  );

  return {
    queryTemplateVersion: requireNestedString(
      "queryTemplate.queryTemplateVersion",
      queryTemplate.queryTemplateVersion,
      "QUERY_TEMPLATE_INVALID"
    ),
    templateText: requireNestedString(
      "queryTemplate.templateText",
      queryTemplate.templateText,
      "QUERY_TEMPLATE_INVALID"
    ),
    allowedParameters: requireStringArray(
      "queryTemplate.allowedParameters",
      queryTemplate.allowedParameters,
      "QUERY_TEMPLATE_INVALID"
    )
  };
}

function requireFieldMappings(value: unknown): ValidatedFieldMapping[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "FIELD_MAPPING_INVALID", "fieldMappings is required");
  }

  return value.map((item, index) => {
    const mapping = requireObjectWithKeys(
      `fieldMappings[${index}]`,
      item,
      FIELD_MAPPING_REQUIRED_FIELDS,
      "FIELD_MAPPING_INVALID"
    );
    const fieldType = requireNestedString(
      `fieldMappings[${index}].fieldType`,
      mapping.fieldType,
      "FIELD_MAPPING_INVALID"
    );
    if (!FIELD_TYPES.has(fieldType)) {
      throw new ApiError(400, "FIELD_MAPPING_INVALID", `fieldMappings[${index}].fieldType is invalid`);
    }

    const normalized: ValidatedFieldMapping = {
      fieldCode: requireNestedString(
        `fieldMappings[${index}].fieldCode`,
        mapping.fieldCode,
        "FIELD_MAPPING_INVALID"
      ),
      headerName: requireNestedString(
        `fieldMappings[${index}].headerName`,
        mapping.headerName,
        "FIELD_MAPPING_INVALID"
      ),
      fieldType,
      orderNo: requireNestedPositiveInteger(
        `fieldMappings[${index}].orderNo`,
        mapping.orderNo,
        "FIELD_MAPPING_INVALID"
      ),
      sensitive: requireNestedBoolean(
        `fieldMappings[${index}].sensitive`,
        mapping.sensitive,
        "FIELD_MAPPING_INVALID"
      ),
      exportable: requireNestedBoolean(
        `fieldMappings[${index}].exportable`,
        mapping.exportable,
        "FIELD_MAPPING_INVALID"
      )
    };

    if (Object.hasOwn(mapping, "maskingRuleCode")) {
      normalized.maskingRuleCode = requireOptionalString(
        `fieldMappings[${index}].maskingRuleCode`,
        mapping.maskingRuleCode,
        "FIELD_MAPPING_INVALID"
      );
    }

    return normalized;
  });
}

function requireOrderBy(value: unknown): ValidatedOrderBy[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, "QUERY_TEMPLATE_INVALID", "orderBy is required");
  }

  return value.map((item, index) => {
    const orderBy = requireObjectWithKeys(
      `orderBy[${index}]`,
      item,
      ORDER_BY_REQUIRED_FIELDS,
      "QUERY_TEMPLATE_INVALID"
    );
    const direction = requireNestedString(
      `orderBy[${index}].direction`,
      orderBy.direction,
      "QUERY_TEMPLATE_INVALID"
    ).toUpperCase();
    if (!ORDER_DIRECTIONS.has(direction)) {
      throw new ApiError(400, "QUERY_TEMPLATE_INVALID", `orderBy[${index}].direction is invalid`);
    }

    return {
      field: requireNestedString(
        `orderBy[${index}].field`,
        orderBy.field,
        "QUERY_TEMPLATE_INVALID"
      ),
      direction: direction as "ASC" | "DESC"
    };
  });
}

function requireObjectWithKeys<T extends readonly string[]>(
  label: string,
  value: unknown,
  requiredKeys: T,
  code: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, code, `${label} is required`);
  }
  const record = value as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key) || record[key] === null) {
      throw new ApiError(400, code, `${label}.${key} is required`);
    }
  }
  return record;
}

function requireStringArray(label: string, value: unknown, code: string): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, code, `${label} is required`);
  }
  return value.map((item, index) =>
    requireNestedString(`${label}[${index}]`, item, code)
  );
}

function requireNestedString(label: string, value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, code, `${label} is required`);
  }
  return value;
}

function requireOptionalString(label: string, value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, code, `${label} must be a non-empty string`);
  }
  return value;
}

function requireNestedPositiveInteger(label: string, value: unknown, code: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new ApiError(400, code, `${label} must be >= 1`);
  }
  return Number(value);
}

function requireNestedBoolean(label: string, value: unknown, code: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiError(400, code, `${label} is required`);
  }
  return value;
}
