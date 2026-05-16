import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewMarkdownPath = "docs/reviews/requirements-complete-review.md";
const reviewJsonPath = "docs/reviews/requirements-complete-review.findings.json";

async function readReviewArtifacts() {
  const [markdown, jsonText] = await Promise.all([
    readFile(reviewMarkdownPath, "utf8"),
    readFile(reviewJsonPath, "utf8")
  ]);

  return {
    markdown,
    report: JSON.parse(jsonText)
  };
}

function sectionBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  assert.notEqual(start, -1, `${startHeading} section must exist`);

  const end = endHeading
    ? markdown.indexOf(endHeading, start + startHeading.length)
    : markdown.length;

  return markdown.slice(start, end === -1 ? markdown.length : end);
}

function extractMarkdownFindingIds(markdown) {
  const findingsSection = sectionBetween(markdown, "## Findings", "## Closed Findings");
  return [...findingsSection.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]).sort();
}

function extractMarkdownVerdict(markdown) {
  const match = markdown.match(/^Verdict:\s*([A-Z_]+)/m);
  assert.ok(match, "Markdown verdict must exist");
  return match[1];
}

function extractCoverage(markdown, heading) {
  const section = sectionBetween(markdown, heading, "\n## ");
  const entries = new Map();

  for (const match of section.matchAll(/^\| (FR-\d{3}|AC-E\d{3}|AC-\d{3}) \| ([^|]+) \|/gm)) {
    entries.set(match[1], match[2].trim());
  }

  assert.notEqual(entries.size, 0, `${heading} must contain coverage rows`);
  return entries;
}

function jsonCoverageMap(report) {
  return new Map(
    [
      ...report.coverage.requirements,
      ...report.coverage.acceptance,
      ...report.coverage.exceptions
    ].map((entry) => [entry.id, entry.status])
  );
}

const allowedCoverageStatuses = new Set([
  "covered",
  "partially_covered",
  "gap",
  "not_applicable"
]);

const expectedRequirementIds = Array.from({ length: 14 }, (_item, index) =>
  `FR-${String(index + 1).padStart(3, "0")}`
);

const expectedAcceptanceIds = Array.from({ length: 21 }, (_item, index) =>
  `AC-${String(index + 1).padStart(3, "0")}`
);

const expectedExceptionIds = Array.from({ length: 27 }, (_item, index) =>
  `AC-E${String(index + 1).padStart(3, "0")}`
);

const expectedTruthSources = [
  "docs/product/prd-lite.md",
  "docs/product/page-inventory.md",
  "docs/product/difficulty-research.md",
  "docs/product/acceptance-criteria.md",
  "docs/product/requirement-interface-matrix.md",
  "docs/product/state-matrix.yaml",
  "docs/architecture/constraints.md"
];

const expectedEvidenceSources = [
  "contracts/openapi.yaml",
  "src/",
  "tests/",
  "docs/testing/ACCEPTANCE_CRITERIA.md",
  "docs/testing/ACCEPTANCE_EXAMPLES.md",
  "docs/testing/TRACEABILITY_MATRIX.md",
  "docs/testing/TEST_DATA_MATRIX.md",
  "docs/testing/test-matrix.md",
  "docs/testing/verify-matrix.md",
  "task.json"
];

function assertCoverageGroup(entries, expectedIds, label) {
  assert.deepEqual(
    entries.map((entry) => entry.id),
    expectedIds,
    `${label} coverage must enumerate every required id in order`
  );

  for (const entry of entries) {
    assert.ok(
      allowedCoverageStatuses.has(entry.status),
      `${entry.id} uses unsupported coverage status ${entry.status}`
    );
  }
}

test("requirements review Markdown and JSON artifacts stay consistent", async () => {
  const { markdown, report } = await readReviewArtifacts();

  for (const truthSource of expectedTruthSources) {
    assert.ok(markdown.includes(`- \`${truthSource}\``), `${truthSource} must be listed in Markdown truth sources`);
  }
  assert.deepEqual(report.truthSources, expectedTruthSources);
  for (const evidenceSource of expectedEvidenceSources) {
    assert.ok(markdown.includes(`- \`${evidenceSource}\``), `${evidenceSource} must be listed in Markdown evidence sources`);
  }
  assert.deepEqual(report.evidenceSources, expectedEvidenceSources);

  const markdownFindingIds = extractMarkdownFindingIds(markdown);
  const jsonFindingIds = report.findings.map((finding) => finding.id).sort();
  assert.deepEqual(jsonFindingIds, markdownFindingIds);

  assertCoverageGroup(report.coverage.requirements, expectedRequirementIds, "FR");
  assertCoverageGroup(report.coverage.acceptance, expectedAcceptanceIds, "AC");
  assertCoverageGroup(report.coverage.exceptions, expectedExceptionIds, "AC-E");

  for (const finding of report.findings) {
    assert.match(finding.severity, /^P[01]$/, `${finding.id} must be P0/P1`);
    assert.ok(finding.requirementIds.length > 0, `${finding.id} must list requirement ids`);
    assert.ok(finding.evidence.length > 0, `${finding.id} must list file evidence`);
    assert.ok(finding.risk.trim().length > 0, `${finding.id} must explain risk`);
    assert.equal(
      finding.suggestedNextTaskId,
      finding.id,
      `${finding.id} must be directly actionable as a follow-up task id`
    );
  }

  assert.equal(report.verdict, extractMarkdownVerdict(markdown));
  assert.ok(
    report.evidenceBoundary.notes.every((note) => !/\boverall verdict (PASS|FAIL)\b/.test(note)),
    "Evidence boundary notes must not contradict or restate the machine verdict with a different PASS/FAIL label"
  );
  assert.ok(
    report.evidenceBoundary.notes.some((note) => note.includes(report.verdict)),
    "Evidence boundary notes should name the same verdict when summarizing new gaps"
  );
  assert.deepEqual(report.evidenceBoundary.notClaimed.sort(), [
    "external business datasource live access",
    "external production MySQL",
    "live OSS/S3"
  ]);
  assert.doesNotMatch(
    report.evidenceBoundary.notes.join("\n"),
    /promote .* to live evidence as verified|claim .* live evidence/u,
    "Evidence boundary notes must not promote docker/mock evidence to verified live evidence"
  );

  const markdownCoverage = new Map([
    ...extractCoverage(markdown, "## FR Coverage Matrix"),
    ...extractCoverage(markdown, "## AC Coverage Matrix"),
    ...extractCoverage(markdown, "## AC-E Coverage Matrix")
  ]);
  assert.deepEqual([...jsonCoverageMap(report).entries()].sort(), [...markdownCoverage.entries()].sort());

  const remainingRisksSection = sectionBetween(markdown, "## Remaining Risks", undefined);
  const remainingRiskIds = [
    ...remainingRisksSection.matchAll(/`([A-Z0-9-]+-\d{3})`/g)
  ].map((match) => match[1]).sort();
  assert.deepEqual(remainingRiskIds, jsonFindingIds);

  const jsonRemainingRiskText = report.remainingRisks.join("\n");
  for (const findingId of jsonFindingIds) {
    assert.match(jsonRemainingRiskText, new RegExp(`\\b${findingId}\\b`));
  }
});
