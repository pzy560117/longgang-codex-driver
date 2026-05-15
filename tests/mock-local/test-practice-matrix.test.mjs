import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const taskJson = JSON.parse(
  readFileSync(new URL("../../task.json", import.meta.url), "utf8").replace(/^\uFEFF/u, "")
);
const verifyMatrix = readFileSync(
  new URL("../../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);

const practiceMappings = [
  {
    label: "API 集成测试",
    script: "test:api",
    tasks: ["TASK-API-HTTP-001", "LOCAL-RELEASE-REHEARSAL-001", "RELEASE-001"],
    boundary: /release 只算 docker\/mock/u
  },
  {
    label: "DB 集成测试",
    script: "test:db",
    tasks: [
      "DB-SCHEMA-001",
      "SCHEDULER-WORKER-001",
      "QUERY-EXECUTOR-001",
      "FILE-SERVICE-001",
      "CLEANUP-JOB-001",
      "SAMPLE-PURCHASE-ORDER-001",
      "LOCAL-RELEASE-REHEARSAL-001",
      "RELEASE-001"
    ],
    boundary: /不能降级为内存替身/u
  },
  {
    label: "Worker 集成测试",
    script: "test:worker",
    tasks: [
      "SCHEDULER-WORKER-001",
      "QUERY-EXECUTOR-001",
      "CLEANUP-JOB-001",
      "LOCAL-RELEASE-REHEARSAL-001",
      "RELEASE-001"
    ],
    boundary: /不替代 query\/file\/sample/u
  },
  {
    label: "Query executor 验证",
    script: "test:query",
    tasks: [
      "QUERY-EXECUTOR-001",
      "SAMPLE-PURCHASE-ORDER-001",
      "LOCAL-RELEASE-REHEARSAL-001",
      "RELEASE-001"
    ],
    boundary: /不声明外部业务库 live 已接入/u
  },
  {
    label: "File service 验证",
    script: "test:file",
    tasks: [
      "FILE-SERVICE-001",
      "CLEANUP-JOB-001",
      "SAMPLE-PURCHASE-ORDER-001",
      "LOCAL-RELEASE-REHEARSAL-001",
      "RELEASE-001"
    ],
    boundary: /不能写成外部 live OSS\/S3 已验证/u
  },
  {
    label: "Sample 样板验证",
    script: "test:sample",
    tasks: ["SAMPLE-PURCHASE-ORDER-001", "LOCAL-RELEASE-REHEARSAL-001", "RELEASE-001"],
    boundary: /live 对象存储不属于当前完成条件/u
  },
  {
    label: "Mock-first local/dev 验收",
    script: "test:mock-local",
    tasks: ["MOCK-FIRST-001", "MOCK-INTEGRATION-001", "TEST-PRACTICE-MATRIX-001"],
    boundary: /不是 release evidence/u
  },
  {
    label: "Object storage smoke",
    script: "test:object-storage-live",
    tasks: ["LOCAL-RELEASE-REHEARSAL-001", "RELEASE-001"],
    boundary: /外部 live OSS\/S3 验证必须另开任务/u
  },
  {
    label: "本地 release rehearsal",
    script: "release:local-rehearsal",
    tasks: ["LOCAL-RELEASE-REHEARSAL-001"],
    boundary: /不能替代 `RELEASE-001` docker\/mock release gate/u
  }
];

test("test practice matrix task owns the drift guard", () => {
  const matrixTask = findTask("TEST-PRACTICE-MATRIX-001");
  const releaseTask = findTask("RELEASE-001");

  assert.equal(matrixTask.passes, true);
  assert.match(matrixTask.test_command, /npm run test:mock-local/u);
  assert.match(matrixTask.test_command, /test-practice-matrix\.test\.mjs/u);
  assert.ok(
    matrixTask.owned_paths.includes("tests/mock-local/test-practice-matrix.test.mjs"),
    "matrix task must own this guard test"
  );
  assert.ok(
    releaseTask.dependencies.includes("TEST-PRACTICE-MATRIX-001"),
    "release must depend on the test practice mapping task"
  );
});

test("each critical test script has a task owner and documented evidence boundary", () => {
  assert.match(verifyMatrix, /## 测试实践到 task 映射/u);

  for (const mapping of practiceMappings) {
    assert.ok(packageJson.scripts?.[mapping.script], `${mapping.script} script must exist`);

    const row = getPracticeRow(mapping.label);
    assert.ok(row, `${mapping.label} row must exist in verify matrix`);
    assert.match(row, new RegExp(escapeRegExp(`npm run ${mapping.script}`), "u"));
    assert.match(row, mapping.boundary, `${mapping.label} must document its evidence boundary`);

    for (const taskId of mapping.tasks) {
      const task = findTask(taskId);
      assert.equal(task.passes, true, `${taskId} must be passed before it can own test practice evidence`);
      assert.match(row, new RegExp(escapeRegExp(taskId), "u"));
      assertTaskMentionsScript(task, mapping.script);
    }
  }
});

test("release gate keeps docker mock evidence separate from external live validation", () => {
  const releaseRow = getPracticeRow("Docker/mock release gate");
  const releaseTask = findTask("RELEASE-001");

  assert.match(releaseTask.test_command, /scripts\\release-verify\.ps1/u);
  assert.match(releaseRow, /本机 Docker MySQL \+ 本地 object storage mock/u);
  assert.match(releaseRow, /外部生产 MySQL 或 live OSS\/S3 不属于当前完成条件/u);
  assert.doesNotMatch(releaseRow, /已验证外部 live OSS\/S3/u);
});

function findTask(taskId) {
  const task = taskJson.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `${taskId} must exist`);
  return task;
}

function getPracticeRow(label) {
  return getPracticeMatrixSection()
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`| ${label} |`)) ?? "";
}

function getPracticeMatrixSection() {
  const sectionStart = verifyMatrix.indexOf("## 测试实践到 task 映射");
  assert.notEqual(sectionStart, -1, "verify matrix must contain the test practice mapping section");

  const nextSectionStart = verifyMatrix.indexOf("\n## ", sectionStart + 1);
  return nextSectionStart === -1
    ? verifyMatrix.slice(sectionStart)
    : verifyMatrix.slice(sectionStart, nextSectionStart);
}

function assertTaskMentionsScript(task, script) {
  const taskText = JSON.stringify(task);
  const expectedCommand = `npm run ${script}`;

  if (task.id === "RELEASE-001") {
    assert.match(taskText, /release-verify\.ps1/u);
    return;
  }

  if (script === "test:object-storage-live" && task.id === "LOCAL-RELEASE-REHEARSAL-001") {
    assert.match(taskText, /object-storage/u);
    return;
  }

  assert.match(
    taskText,
    new RegExp(escapeRegExp(expectedCommand), "u"),
    `${task.id} must mention ${expectedCommand}`
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
