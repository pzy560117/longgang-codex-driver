import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type ExportRegistryUpsertInput = {
  taskCode: string;
  subsystemCode: string;
  displayName: string;
  enabled: boolean;
  concurrencyLimit: number;
  fileRetentionDays: number;
  taskHistoryRetentionDays: number;
  singleFileMaxRows: number;
  exportMaxRows: number;
  datasourceCode: string;
  supportedFormats: string;
  parameterSchema: string;
  queryTemplate: string;
  fieldMappings: string;
  maskingPolicy: string;
  dataScopeTemplate: string;
  cursorField: string;
  orderBy: string;
  batchSize: number;
  configSnapshotDigest: string;
  parameterSchemaDigest: string;
  fieldMappingDigest: string;
  maskingPolicyDigest: string;
  now: Date;
};

export type ExportRegistryRecord = {
  taskCode: string;
  subsystemCode: string;
  displayName: string;
  enabled: boolean;
  concurrencyLimit: number;
  fileRetentionDays: number;
  taskHistoryRetentionDays: number;
  singleFileMaxRows: number;
  exportMaxRows: number;
  datasourceCode: string;
  supportedFormats: string | null;
  parameterSchema: string | null;
  queryTemplate: string | null;
  fieldMappings: string | null;
  maskingPolicy: string | null;
  dataScopeTemplate: string | null;
  cursorField: string | null;
  orderBy: string | null;
  batchSize: number | null;
  configSnapshotDigest: string;
  createdAt?: Date;
  updatedAt?: Date;
};

function toRegistryRecord(row: {
  task_code: string;
  subsystem_code: string;
  display_name: string;
  enabled: number | boolean;
  concurrency_limit: number;
  file_retention_days: number;
  task_history_retention_days: number;
  single_file_max_rows: number;
  export_max_rows: number;
  datasource_code: string;
  supported_formats: string | null;
  parameter_schema: string | null;
  query_template: string | null;
  field_mappings: string | null;
  masking_policy: string | null;
  data_scope_template: string | null;
  cursor_field: string | null;
  order_by: string | null;
  batch_size: number | null;
  config_snapshot_digest: string;
  created_at?: Date;
  updated_at?: Date;
}): ExportRegistryRecord {
  return {
    taskCode: row.task_code,
    subsystemCode: row.subsystem_code,
    displayName: row.display_name,
    enabled: row.enabled === true || row.enabled === 1,
    concurrencyLimit: row.concurrency_limit,
    fileRetentionDays: row.file_retention_days,
    taskHistoryRetentionDays: row.task_history_retention_days,
    singleFileMaxRows: row.single_file_max_rows,
    exportMaxRows: row.export_max_rows,
    datasourceCode: row.datasource_code,
    supportedFormats: row.supported_formats,
    parameterSchema: row.parameter_schema,
    queryTemplate: row.query_template,
    fieldMappings: row.field_mappings,
    maskingPolicy: row.masking_policy,
    dataScopeTemplate: row.data_scope_template,
    cursorField: row.cursor_field,
    orderBy: row.order_by,
    batchSize: row.batch_size,
    configSnapshotDigest: row.config_snapshot_digest,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createExportRegistryRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async insertRegistry(input: ExportRegistryUpsertInput): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("export_registries")
          .values({
            task_code: input.taskCode,
            subsystem_code: input.subsystemCode,
            display_name: input.displayName,
            enabled: input.enabled,
            concurrency_limit: input.concurrencyLimit,
            file_retention_days: input.fileRetentionDays,
            task_history_retention_days: input.taskHistoryRetentionDays,
            single_file_max_rows: input.singleFileMaxRows,
            export_max_rows: input.exportMaxRows,
            datasource_code: input.datasourceCode,
            supported_formats: input.supportedFormats,
            parameter_schema: input.parameterSchema,
            query_template: input.queryTemplate,
            field_mappings: input.fieldMappings,
            masking_policy: input.maskingPolicy,
            data_scope_template: input.dataScopeTemplate,
            cursor_field: input.cursorField,
            order_by: input.orderBy,
            batch_size: input.batchSize,
            config_snapshot_digest: input.configSnapshotDigest,
            created_at: input.now,
            updated_at: input.now
          })
          .execute();

        await trx
          .insertInto("export_registry_versions")
          .values({
            task_code: input.taskCode,
            config_snapshot_digest: input.configSnapshotDigest,
            parameter_schema_digest: input.parameterSchemaDigest,
            field_mapping_digest: input.fieldMappingDigest,
            masking_policy_digest: input.maskingPolicyDigest,
            created_at: input.now
          })
          .execute();
      });
    },

    async upsertRegistry(input: ExportRegistryUpsertInput): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("export_registries")
          .values({
            task_code: input.taskCode,
            subsystem_code: input.subsystemCode,
            display_name: input.displayName,
            enabled: input.enabled,
            concurrency_limit: input.concurrencyLimit,
            file_retention_days: input.fileRetentionDays,
            task_history_retention_days: input.taskHistoryRetentionDays,
            single_file_max_rows: input.singleFileMaxRows,
            export_max_rows: input.exportMaxRows,
            datasource_code: input.datasourceCode,
            supported_formats: input.supportedFormats,
            parameter_schema: input.parameterSchema,
            query_template: input.queryTemplate,
            field_mappings: input.fieldMappings,
            masking_policy: input.maskingPolicy,
            data_scope_template: input.dataScopeTemplate,
            cursor_field: input.cursorField,
            order_by: input.orderBy,
            batch_size: input.batchSize,
            config_snapshot_digest: input.configSnapshotDigest,
            created_at: input.now,
            updated_at: input.now
          })
          .onDuplicateKeyUpdate({
            subsystem_code: input.subsystemCode,
            display_name: input.displayName,
            enabled: input.enabled,
            concurrency_limit: input.concurrencyLimit,
            file_retention_days: input.fileRetentionDays,
            task_history_retention_days: input.taskHistoryRetentionDays,
            single_file_max_rows: input.singleFileMaxRows,
            export_max_rows: input.exportMaxRows,
            datasource_code: input.datasourceCode,
            supported_formats: input.supportedFormats,
            parameter_schema: input.parameterSchema,
            query_template: input.queryTemplate,
            field_mappings: input.fieldMappings,
            masking_policy: input.maskingPolicy,
            data_scope_template: input.dataScopeTemplate,
            cursor_field: input.cursorField,
            order_by: input.orderBy,
            batch_size: input.batchSize,
            config_snapshot_digest: input.configSnapshotDigest,
            updated_at: input.now
          })
          .execute();

        await trx
          .insertInto("export_registry_versions")
          .values({
            task_code: input.taskCode,
            config_snapshot_digest: input.configSnapshotDigest,
            parameter_schema_digest: input.parameterSchemaDigest,
            field_mapping_digest: input.fieldMappingDigest,
            masking_policy_digest: input.maskingPolicyDigest,
            created_at: input.now
          })
          .onDuplicateKeyUpdate({
            parameter_schema_digest: input.parameterSchemaDigest,
            field_mapping_digest: input.fieldMappingDigest,
            masking_policy_digest: input.maskingPolicyDigest
          })
          .execute();
      });
    },

    async findRegistryByTaskCode(taskCode: string): Promise<ExportRegistryRecord | undefined> {
      const row = await db
        .selectFrom("export_registries")
        .selectAll()
        .where("task_code", "=", taskCode)
        .executeTakeFirst();

      return row ? toRegistryRecord(row) : undefined;
    },

    async listRegistries(filters: {
      taskCode?: string;
      subsystemCode?: string;
      enabled?: boolean;
      limit?: number;
      offset?: number;
    } = {}): Promise<ExportRegistryRecord[]> {
      let query = db.selectFrom("export_registries").selectAll();

      if (filters.taskCode) {
        query = query.where("task_code", "=", filters.taskCode);
      }
      if (filters.subsystemCode) {
        query = query.where("subsystem_code", "=", filters.subsystemCode);
      }
      if (filters.enabled !== undefined) {
        query = query.where("enabled", "=", filters.enabled);
      }

      const rows = await query
        .orderBy("updated_at", "desc")
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)
        .execute();

      return rows.map(toRegistryRecord);
    },

    async setRegistryEnabled(input: {
      taskCode: string;
      enabled: boolean;
      now: Date;
    }): Promise<ExportRegistryRecord | undefined> {
      await db
        .updateTable("export_registries")
        .set({
          enabled: input.enabled,
          updated_at: input.now
        })
        .where("task_code", "=", input.taskCode)
        .execute();

      return this.findRegistryByTaskCode(input.taskCode);
    }
  };
}
