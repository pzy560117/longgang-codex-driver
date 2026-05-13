import type { ExportRegistry } from "../shared/types.js";

export class InMemoryRegistryRepository {
  private readonly registries = new Map<string, ExportRegistry>();
  private readonly snapshots = new Map<string, ExportRegistry>();

  save(registry: ExportRegistry): ExportRegistry {
    this.registries.set(registry.taskCode, registry);
    this.snapshots.set(registry.configSnapshotDigest, structuredClone(registry));
    return registry;
  }

  findByTaskCode(taskCode: string): ExportRegistry | undefined {
    return this.registries.get(taskCode);
  }

  findSnapshotByDigest(configSnapshotDigest: string): ExportRegistry | undefined {
    return this.snapshots.get(configSnapshotDigest);
  }

  list(): ExportRegistry[] {
    return [...this.registries.values()];
  }
}
