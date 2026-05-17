import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "docs", "testing", "api-acceptance-test-report.md");
const startedAt = new Date();

const command = "node";
const args = [
  "--import",
  "tsx",
  "--test",
  "--test-concurrency=1",
  "tests/acceptance/api-manual-acceptance.test.mjs"
];

const result = await run(command, args);
const endedAt = new Date();
const verdict = result.exitCode === 0 ? "PASS" : "FAIL";
const counts = parseTapCounts(result.stdout);

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  [
    "# API 自动验收测试报告",
    "",
    `**结论**: ${verdict}`,
    `**开始时间**: ${startedAt.toISOString()}`,
    `**结束时间**: ${endedAt.toISOString()}`,
    `**验证命令**: \`${[command, ...args].join(" ")}\``,
    "",
    "## 覆盖范围",
    "",
    "| 场景 | 关联需求 | 验证点 |",
    "| --- | --- | --- |",
    "| 创建导出任务主流程 | FR-001 / FR-002 / FR-010 | 注册配置、创建 PENDING 任务、查询详情、历史分页、审计成功记录 |",
    "| 幂等与冲突 | FR-001 / FR-013 | 相同 clientRequestId 重放返回原 taskId，参数变化返回 IDEMPOTENCY_CONFLICT |",
    "| 取消任务 | FR-012 | PENDING 任务取消后详情状态为 CANCELED |",
    "| 认证与负向创建 | FR-008 / FR-009 / FR-010 | 缺少 HMAC 签名、格式不支持、缺少必填参数、禁用配置均失败并保持错误脱敏 |",
    "",
    "## 测试摘要",
    "",
    "| 指标 | 数量 |",
    "| --- | ---: |",
    `| 测试套件 | ${counts.suites ?? "unknown"} |`,
    `| 用例总数 | ${counts.tests ?? "unknown"} |`,
    `| 通过 | ${counts.pass ?? "unknown"} |`,
    `| 失败 | ${counts.fail ?? "unknown"} |`,
    `| 取消 | ${counts.cancelled ?? "unknown"} |`,
    `| 跳过 | ${counts.skipped ?? "unknown"} |`,
    "",
    "## 证据边界",
    "",
    "- 该报告来自本机 Node test + Docker/local MySQL 环境，验证 HTTP API、MySQL 持久化和审计记录。",
    "- 该报告不声明外部生产 MySQL、真实 OSS/S3 或外部网关 live evidence。",
    "- 认证上下文通过测试进程内 HMAC secret 生成，不写入仓库。",
    "",
    "## 原始输出",
    "",
    "```text",
    trimForReport(result.stdout),
    result.stderr ? "\n[stderr]\n" + trimForReport(result.stderr) : "",
    "```",
    ""
  ].join("\n"),
  "utf8"
);

console.log(`acceptance report written: ${path.relative(root, reportPath)}`);
process.exitCode = result.exitCode;

function run(file, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(file, commandArgs, {
      cwd: root,
      shell: false,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function parseTapCounts(output) {
  const counts = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^[#\u2139]\s+(suites|tests|pass|fail|cancelled|skipped)\s+(\d+)/u);
    if (match) {
      counts[match[1]] = Number(match[2]);
    }
  }
  return counts;
}

function trimForReport(text) {
  const maxLength = 12000;
  if (text.length <= maxLength) {
    return text.trimEnd();
  }
  return `${text.slice(0, maxLength).trimEnd()}\n... output truncated ...`;
}
