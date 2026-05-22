import type { ExportRegistryRecord } from "../repositories/index.ts";

export const SAMPLE_PURCHASE_ORDER_TASK_CODE = "purchase-order-export";
export const SAMPLE_PURCHASE_ORDER_SUBSYSTEM = "purchase";
export const SAMPLE_PURCHASE_ORDER_CURSOR_FIELD = "orderId";
export const SAMPLE_PURCHASE_ORDER_SINGLE_FILE_MAX_ROWS = 20000;
export const SAMPLE_PURCHASE_ORDER_EXPORT_MAX_ROWS = 100000;
export const SAMPLE_PURCHASE_ORDER_BATCH_SIZE = 5000;

export const SAMPLE_PURCHASE_ORDER_SUPPORTED_FORMATS = ["XLSX", "ZIP"] as const;

export const SAMPLE_PURCHASE_ORDER_PARAMETER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["createdAtFrom", "createdAtTo"],
  properties: {
    createdAtFrom: { type: "string" },
    createdAtTo: { type: "string" },
    orderStatus: { type: "string" },
    supplierId: { type: "string" },
    purchaseOrgId: { type: "string" },
    keyword: { type: "string" }
  }
} as const;

export const SAMPLE_PURCHASE_ORDER_QUERY_TEMPLATE = {
  queryTemplateVersion: "purchase-order-v1",
  templateText:
    "SELECT order_id AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, order_status AS orderStatus, supplier_name AS supplierName, purchase_org_name AS purchaseOrgName, purchaser_name AS purchaserName, created_at AS createdAt, total_amount AS totalAmount, currency_code AS currency, contact_name AS contactName, contact_phone AS contactPhone FROM purchase_orders_view WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo AND (:orderStatus IS NULL OR order_status = :orderStatus) AND (:supplierId IS NULL OR supplier_id = :supplierId) AND (:purchaseOrgId IS NULL OR purchase_org_id = :purchaseOrgId) AND (:keyword IS NULL OR (order_no LIKE :keyword OR supplier_name LIKE :keyword OR contact_name LIKE :keyword))",
  allowedParameters: [
    "createdAtFrom",
    "createdAtTo",
    "orderStatus",
    "supplierId",
    "purchaseOrgId",
    "keyword"
  ]
} as const;

export const SAMPLE_PURCHASE_ORDER_FIELD_MAPPINGS = [
  {
    fieldCode: "orderNo",
    headerName: "订单号",
    fieldType: "STRING",
    orderNo: 1,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "orderStatus",
    headerName: "订单状态",
    fieldType: "STRING",
    orderNo: 2,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "supplierName",
    headerName: "供应商",
    fieldType: "STRING",
    orderNo: 3,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "purchaseOrgName",
    headerName: "采购组织",
    fieldType: "STRING",
    orderNo: 4,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "purchaserName",
    headerName: "采购员",
    fieldType: "STRING",
    orderNo: 5,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "createdAt",
    headerName: "创建时间",
    fieldType: "DATETIME",
    orderNo: 6,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "totalAmount",
    headerName: "总金额",
    fieldType: "DECIMAL",
    orderNo: 7,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "currency",
    headerName: "币种",
    fieldType: "STRING",
    orderNo: 8,
    sensitive: false,
    exportable: true
  },
  {
    fieldCode: "contactName",
    headerName: "联系人姓名",
    fieldType: "STRING",
    orderNo: 9,
    sensitive: true,
    exportable: true,
    maskingRuleCode: "person_name_mask"
  },
  {
    fieldCode: "contactPhone",
    headerName: "联系人手机号",
    fieldType: "STRING",
    orderNo: 10,
    sensitive: true,
    exportable: true,
    maskingRuleCode: "phone_mask"
  }
] as const;

export const SAMPLE_PURCHASE_ORDER_MASKING_POLICY = {
  rules: {
    person_name_mask: {
      type: "PERSON_NAME"
    },
    phone_mask: {
      type: "PHONE",
      preservePrefix: 3,
      preserveSuffix: 4
    }
  }
} as const;

export const SAMPLE_PURCHASE_ORDER_ORDER_BY = [
  { field: "createdAt", direction: "ASC" },
  { field: "orderId", direction: "ASC" }
] as const;

type RegistryContractShape = Pick<
  ExportRegistryRecord,
  | "taskCode"
  | "subsystemCode"
  | "singleFileMaxRows"
  | "exportMaxRows"
  | "supportedFormats"
  | "parameterSchema"
  | "queryTemplate"
  | "fieldMappings"
  | "maskingPolicy"
  | "cursorField"
  | "orderBy"
>;

type SamplePurchaseOrderContract = {
  taskCode: string;
  subsystemCode: string;
  displayName: string;
  datasourceCode: string;
  supportedFormats: readonly string[];
  parameterSchema: typeof SAMPLE_PURCHASE_ORDER_PARAMETER_SCHEMA;
  queryTemplate: typeof SAMPLE_PURCHASE_ORDER_QUERY_TEMPLATE;
  fieldMappings: typeof SAMPLE_PURCHASE_ORDER_FIELD_MAPPINGS;
  maskingPolicy: typeof SAMPLE_PURCHASE_ORDER_MASKING_POLICY;
  cursorField: typeof SAMPLE_PURCHASE_ORDER_CURSOR_FIELD;
  orderBy: typeof SAMPLE_PURCHASE_ORDER_ORDER_BY;
  singleFileMaxRows: number;
  exportMaxRows: number;
  batchSize: number;
};

export function createSamplePurchaseOrderRegistryContract(): SamplePurchaseOrderContract {
  return {
    taskCode: SAMPLE_PURCHASE_ORDER_TASK_CODE,
    subsystemCode: SAMPLE_PURCHASE_ORDER_SUBSYSTEM,
    displayName: "采购订单导出样板",
    datasourceCode: "purchase-ro",
    supportedFormats: [...SAMPLE_PURCHASE_ORDER_SUPPORTED_FORMATS],
    parameterSchema: SAMPLE_PURCHASE_ORDER_PARAMETER_SCHEMA,
    queryTemplate: SAMPLE_PURCHASE_ORDER_QUERY_TEMPLATE,
    fieldMappings: SAMPLE_PURCHASE_ORDER_FIELD_MAPPINGS,
    maskingPolicy: SAMPLE_PURCHASE_ORDER_MASKING_POLICY,
    cursorField: SAMPLE_PURCHASE_ORDER_CURSOR_FIELD,
    orderBy: SAMPLE_PURCHASE_ORDER_ORDER_BY,
    singleFileMaxRows: SAMPLE_PURCHASE_ORDER_SINGLE_FILE_MAX_ROWS,
    exportMaxRows: SAMPLE_PURCHASE_ORDER_EXPORT_MAX_ROWS,
    batchSize: SAMPLE_PURCHASE_ORDER_BATCH_SIZE
  };
}

export function isSamplePurchaseOrderRegistry(input: {
  taskCode: string;
  subsystemCode: string;
}): boolean {
  return (
    input.taskCode === SAMPLE_PURCHASE_ORDER_TASK_CODE &&
    input.subsystemCode === SAMPLE_PURCHASE_ORDER_SUBSYSTEM
  );
}

export function assertSamplePurchaseOrderRegistryContract(registry: RegistryContractShape): void {
  if (!isSamplePurchaseOrderRegistry(registry)) {
    return;
  }

  if (registry.singleFileMaxRows !== SAMPLE_PURCHASE_ORDER_SINGLE_FILE_MAX_ROWS) {
    throw sampleContractError(
      "QUERY_TEMPLATE_INVALID",
      `sample singleFileMaxRows must be ${SAMPLE_PURCHASE_ORDER_SINGLE_FILE_MAX_ROWS}`
    );
  }
  if (registry.exportMaxRows !== SAMPLE_PURCHASE_ORDER_EXPORT_MAX_ROWS) {
    throw sampleContractError(
      "QUERY_TEMPLATE_INVALID",
      `sample exportMaxRows must be ${SAMPLE_PURCHASE_ORDER_EXPORT_MAX_ROWS}`
    );
  }

  const supportedFormats = parseJsonStringArray(
    registry.supportedFormats,
    "QUERY_TEMPLATE_INVALID",
    "sample supportedFormats"
  );
  for (const format of SAMPLE_PURCHASE_ORDER_SUPPORTED_FORMATS) {
    if (!supportedFormats.includes(format)) {
      throw sampleContractError(
        "QUERY_TEMPLATE_INVALID",
        `sample supportedFormats must include ${format}`
      );
    }
  }

  if (registry.cursorField !== SAMPLE_PURCHASE_ORDER_CURSOR_FIELD) {
    throw sampleContractError(
      "QUERY_TEMPLATE_INVALID",
      `sample cursorField must be ${SAMPLE_PURCHASE_ORDER_CURSOR_FIELD}`
    );
  }

  const parameterSchema = parseJsonValue<Record<string, unknown>>(
    registry.parameterSchema,
    "QUERY_TEMPLATE_INVALID",
    "sample parameterSchema"
  );
  assertPropertyNames(
    Object.keys(readRecord(parameterSchema.properties)),
    Object.keys(SAMPLE_PURCHASE_ORDER_PARAMETER_SCHEMA.properties),
    "QUERY_TEMPLATE_INVALID",
    "sample parameterSchema properties"
  );

  const queryTemplate = parseJsonValue<Record<string, unknown>>(
    registry.queryTemplate,
    "QUERY_TEMPLATE_INVALID",
    "sample queryTemplate"
  );
  if (queryTemplate.queryTemplateVersion !== SAMPLE_PURCHASE_ORDER_QUERY_TEMPLATE.queryTemplateVersion) {
    throw sampleContractError(
      "QUERY_TEMPLATE_INVALID",
      "sample queryTemplateVersion does not match the approved contract"
    );
  }
  assertPropertyNames(
    normalizeStringArray(queryTemplate.allowedParameters),
    [...SAMPLE_PURCHASE_ORDER_QUERY_TEMPLATE.allowedParameters],
    "QUERY_TEMPLATE_INVALID",
    "sample queryTemplate allowedParameters"
  );

  const fieldMappings = parseJsonValue<Array<Record<string, unknown>>>(
    registry.fieldMappings,
    "FIELD_MAPPING_INVALID",
    "sample fieldMappings"
  );
  assertPropertyNames(
    fieldMappings.map((mapping) => String(mapping.headerName ?? "")),
    SAMPLE_PURCHASE_ORDER_FIELD_MAPPINGS.map((mapping) => mapping.headerName),
    "FIELD_MAPPING_INVALID",
    "sample field header order"
  );

  const maskingPolicy = parseJsonValue<Record<string, unknown>>(
    registry.maskingPolicy,
    "MASKING_RULE_ERROR",
    "sample maskingPolicy"
  );
  const rules = readRecord(maskingPolicy.rules);
  for (const ruleCode of ["person_name_mask", "phone_mask"]) {
    if (!rules[ruleCode]) {
      throw sampleContractError(
        "MASKING_RULE_ERROR",
        `sample maskingPolicy is missing ${ruleCode}`
      );
    }
  }

  const orderBy = parseJsonValue<Array<Record<string, unknown>>>(
    registry.orderBy,
    "QUERY_TEMPLATE_INVALID",
    "sample orderBy"
  );
  assertPropertyNames(
    orderBy.map((item) => `${String(item.field ?? "")}:${String(item.direction ?? "").toUpperCase()}`),
    SAMPLE_PURCHASE_ORDER_ORDER_BY.map((item) => `${item.field}:${item.direction}`),
    "QUERY_TEMPLATE_INVALID",
    "sample orderBy"
  );
}

function parseJsonValue<T>(value: string | null, code: string, label: string): T {
  if (!value) {
    throw sampleContractError(code, `${label} is required`);
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    throw sampleContractError(code, `${label} must be valid JSON`);
  }
}

function parseJsonStringArray(
  value: string | null,
  code: string,
  label: string
): string[] {
  return normalizeStringArray(parseJsonValue<unknown>(value, code, label));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function assertPropertyNames(
  actual: string[],
  expected: string[],
  code: string,
  label: string
): void {
  if (
    actual.length !== expected.length ||
    actual.some((item, index) => item !== expected[index])
  ) {
    throw sampleContractError(
      code,
      `${label} must match the approved purchase-order sample contract`
    );
  }
}

function sampleContractError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  error.name = code;
  return error;
}
