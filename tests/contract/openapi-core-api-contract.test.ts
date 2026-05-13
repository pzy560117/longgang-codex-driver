import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const openapi = readFileSync(new URL("../../contracts/openapi.yaml", import.meta.url), "utf8");

describe("CORE-API-001 contract coverage", () => {
  it("covers task and registry endpoints required by CORE-API-001", () => {
    expect(openapi).toContain("/export/tasks:");
    expect(openapi).toContain("/export/tasks/{taskId}:");
    expect(openapi).toContain("/export/tasks/{taskId}/cancel:");
    expect(openapi).toContain("/export/tasks/{taskId}/retry:");
    expect(openapi).toContain("/export/registries:");
    expect(openapi).toContain("/export/registries/{taskCode}/enable:");
    expect(openapi).toContain("/export/registries/{taskCode}/disable:");
  });

  it("pins idempotency, snapshot and auth fields required by the implementation", () => {
    expect(openapi).toContain("idempotencyScope");
    expect(openapi).toContain("configSnapshotDigest");
    expect(openapi).toContain("requestDigest");
    expect(openapi).toContain("AUTH_CONTEXT_MISSING");
    expect(openapi).toContain("INVALID_TASK_STATE");
    expect(openapi).toContain("ACTIVE_ATTEMPT_CONFLICT");
  });
});
