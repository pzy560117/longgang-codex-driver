Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$requiredPaths = @(
  "docs/product/prd-lite.md",
  "docs/product/state-matrix.yaml",
  "docs/product/requirement-interface-matrix.md",
  "docs/product/difficulty-research.md",
  "docs/design/design-brief.md",
  "docs/design/ai-image-brief.md",
  "docs/design/ui-image-review.md",
  "docs/design/image-to-frontend-spec.md",
  "docs/design/component-map.md",
  "docs/design/screen-states.md",
  "plans/features/ticket-filter.dev-plan.md",
  "contracts/openapi.yaml",
  "contracts/orval.config.ts",
  "packages/ui/TicketFilterBar.tsx",
  "stories/TicketFilterBar.stories.tsx",
  "packages/api-client/http-client.ts",
  "packages/api-client/generated/ticket-api.ts",
  "packages/api-client/generated/model/Ticket.ts"
)

$missing = @()
foreach ($relativePath in $requiredPaths) {
  $fullPath = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    $missing += $relativePath
  }
}

if ($missing.Count -gt 0) {
  Write-Output "Missing required demo assets:"
  $missing | ForEach-Object { Write-Output "- $_" }
  exit 1
}

Write-Output "Ticket filter demo verify passed."
