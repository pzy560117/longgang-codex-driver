import { AuditLogService } from "../audit-log/service.js";
import { fail } from "../shared/errors.js";
import { digest } from "../shared/hash.js";
import type { AuthContext, ExportRegistry, ExportRegistryUpsertRequest } from "../shared/types.js";
import { InMemoryRegistryRepository } from "./registry-repository.js";

interface RegistryConfigServiceOptions {
  repository: InMemoryRegistryRepository;
  auditLog: AuditLogService;
}

export class RegistryConfigService {
  private readonly repository: InMemoryRegistryRepository;
  private readonly auditLog: AuditLogService;

  constructor(options: RegistryConfigServiceOptions) {
    this.repository = options.repository;
    this.auditLog = options.auditLog;
  }

  createRegistry(context: AuthContext, request: ExportRegistryUpsertRequest): ExportRegistry {
    this.assertAuthContext(context);
    this.assertAdmin(context);
    const registry = this.buildRegistry(request);
    this.repository.save(registry);
    this.auditLog.record(context, "REGISTRY_CREATE", { taskCode: request.taskCode });
    return registry;
  }

  updateRegistry(
    context: AuthContext,
    taskCode: string,
    request: ExportRegistryUpsertRequest
  ): ExportRegistry {
    this.assertAuthContext(context);
    this.assertAdmin(context);
    if (!this.repository.findByTaskCode(taskCode)) {
      fail("REGISTRY_NOT_FOUND", "Registry does not exist.");
    }
    const registry = this.buildRegistry({ ...request, taskCode });
    this.repository.save(registry);
    this.auditLog.record(context, "REGISTRY_UPDATE", { taskCode });
    return registry;
  }

  enableRegistry(context: AuthContext, taskCode: string): ExportRegistry {
    return this.setEnabled(context, taskCode, true, "REGISTRY_ENABLE");
  }

  disableRegistry(context: AuthContext, taskCode: string): ExportRegistry {
    return this.setEnabled(context, taskCode, false, "REGISTRY_DISABLE");
  }

  getRegistry(taskCode: string): ExportRegistry {
    return this.repository.findByTaskCode(taskCode) ?? fail("REGISTRY_NOT_FOUND", "Registry does not exist.");
  }

  getSnapshotByDigest(configSnapshotDigest: string): ExportRegistry {
    return (
      this.repository.findSnapshotByDigest(configSnapshotDigest) ??
      fail("REGISTRY_SNAPSHOT_NOT_FOUND", "Registry snapshot does not exist.")
    );
  }

  listRegistries(context: AuthContext, filter: { enabled?: boolean }): ExportRegistry[] {
    this.assertAuthContext(context);
    return this.repository.list().filter((registry) => {
      if (filter.enabled === undefined) {
        return true;
      }
      return registry.enabled === filter.enabled;
    });
  }

  assertAuthContext(context: AuthContext): void {
    if (!context.operatorId || !context.tenantId || !context.requestId || !Array.isArray(context.roleCodes)) {
      fail("AUTH_CONTEXT_MISSING", "Auth context is incomplete.");
    }
  }

  private setEnabled(
    context: AuthContext,
    taskCode: string,
    enabled: boolean,
    action: "REGISTRY_ENABLE" | "REGISTRY_DISABLE"
  ): ExportRegistry {
    this.assertAuthContext(context);
    this.assertAdmin(context);
    const current = this.getRegistry(taskCode);
    const updated = this.buildRegistry({ ...current, enabled });
    this.repository.save(updated);
    this.auditLog.record(context, action, { taskCode });
    return updated;
  }

  private assertAdmin(context: AuthContext): void {
    if (!context.roleCodes.includes("EXPORT_ADMIN")) {
      fail("PERMISSION_DENIED", "Registry mutations require export admin role.");
    }
  }

  private buildRegistry(request: ExportRegistryUpsertRequest): ExportRegistry {
    const now = new Date().toISOString();
    const parameterSchemaDigest = digest(request.parameterSchema);
    const fieldMappingDigest = digest(request.fieldMappings);
    const maskingPolicyDigest = digest(request.maskingPolicy);
    const configSnapshotDigest = digest({
      ...request,
      parameterSchemaDigest,
      fieldMappingDigest,
      maskingPolicyDigest
    });

    return {
      ...structuredClone(request),
      configSnapshotDigest,
      parameterSchemaDigest,
      fieldMappingDigest,
      maskingPolicyDigest,
      createdAt: now,
      updatedAt: now
    };
  }
}
