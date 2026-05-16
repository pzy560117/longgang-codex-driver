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

test("requirements review Markdown and JSON artifacts stay consistent", async () => {
  const { markdown, report } = await readReviewArtifacts();

  const markdownFindingIds = extractMarkdownFindingIds(markdown);
  const jsonFindingIds = report.findings.map((finding) => finding.id).sort();
  assert.deepEqual(jsonFindingIds, markdownFindingIds);

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
