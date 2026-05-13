import { beforeEach, describe, expect, it } from "vitest";

import { AuditLogService } from "../../src/audit-log/service.js";
import { RegistryConfigService } from "../../src/registry-config/service.js";
import { InMemoryRegistryRepository } from "../../src/registry-config/registry-repository.js";
import type { AuthContext, ExportRegistryUpsertRequest } from "../../src/shared/types.js";

const adminContext: AuthContext = {
  operatorId: "admin-001",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_ADMIN"],
  orgScope: ["ORG-001"],
  requestId: "req-admin-001"
};

const operatorContext: AuthContext = {
  operatorId: "user-001",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_OPERATOR"],
  orgScope: ["ORG-001"],
  requestId: "req-user-001"
};

const registryRequest: ExportRegistryUpsertRequest = {
  taskCode: "purchase-order-export",
  subsystemCode: "purchase",
  displayName: "Purchase order export",
  enabled: true,
  concurrencyLimit: 3,
  fileRetentionDays: 15,
  taskHistoryRetentionDays: 30,
  singleFileMaxRows: 20000,
  exportMaxRows: 100000,
  supportedFormats: ["XLSX", "ZIP"],
  datasourceCode: "purchase_ro",
  parameterSchema: {
    required: ["createdAtFrom", "createdAtTo"],
    properties: {
      createdAtFrom: { type: "string" },
      createdAtTo: { type: "string" }
    }
  },
  queryTemplate: {
    queryTemplateVersion: "v1",
    templateText: "select * from purchase_orders",
    allowedParameters: ["createdAtFrom", "createdAtTo"]
  },
  fieldMappings: [
    {
      fieldCode: "orderNo",
      headerName: "Order No",
      fieldType: "STRING",
      orderNo: 1,
      sensitive: false,
      exportable: true
    },
    {
      fieldCode: "contactPhone",
      headerName: "Contact Phone",
      fieldType: "STRING",
      orderNo: 2,
      sensitive: true,
      exportable: true,
      maskingRuleCode: "phone_mask"
    }
  ],
  maskingPolicy: {
    rules: {
      phone_mask: {
        type: "PHONE",
        preservePrefix: 3,
        preserveSuffix: 4
      }
    }
  },
  dataScopeTemplate: "tenant_id = :tenantId and org_id in (:orgScope)",
  cursorField: "orderId",
  orderBy: [{ field: "orderId", direction: "ASC" }],
  batchSize: 1000
};

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected error code ${code}`);
}

describe("RegistryConfigService", () => {
  let auditLog: AuditLogService;
  let registryService: RegistryConfigService;

  beforeEach(() => {
    auditLog = new AuditLogService();
    registryService = new RegistryConfigService({
      repository: new InMemoryRegistryRepository(),
      auditLog
    });
  });

  it("FR-007 creates registries with summary digests and supports enable/disable flows", () => {
    const created = registryService.createRegistry(adminContext, registryRequest);

    expect(created.taskCode).toBe(registryRequest.taskCode);
    expect(created.enabled).toBe(true);
    expect(created.configSnapshotDigest).toMatch(/^sha256:/);
    expect(created.parameterSchemaDigest).toMatch(/^sha256:/);
    expect(created.fieldMappingDigest).toMatch(/^sha256:/);
    expect(created.maskingPolicyDigest).toMatch(/^sha256:/);

    const disabled = registryService.disableRegistry(adminContext, registryRequest.taskCode);
    expect(disabled.enabled).toBe(false);

    const enabled = registryService.enableRegistry(adminContext, registryRequest.taskCode);
    expect(enabled.enabled).toBe(true);
  });

  it("FR-007 enforces admin-only registry mutations", () => {
    expectErrorCode(() => registryService.createRegistry(operatorContext, registryRequest), "PERMISSION_DENIED");
  });

  it("FR-007 and FR-013 preserves config snapshot summary for historical lookup after updates", () => {
    const created = registryService.createRegistry(adminContext, registryRequest);
    const updated = registryService.updateRegistry(adminContext, registryRequest.taskCode, {
      ...registryRequest,
      displayName: "Purchase order export v2",
      queryTemplate: {
        ...registryRequest.queryTemplate,
        queryTemplateVersion: "v2"
      }
    });

    expect(updated.configSnapshotDigest).not.toBe(created.configSnapshotDigest);

    const snapshot = registryService.getSnapshotByDigest(created.configSnapshotDigest);
    expect(snapshot.configSnapshotDigest).toBe(created.configSnapshotDigest);
    expect(snapshot.queryTemplate.queryTemplateVersion).toBe("v1");
  });
});
