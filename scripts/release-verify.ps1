$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VerifyScript = Join-Path $ProjectRoot "verify.ps1"

& $VerifyScript -Commands @(
  "npm audit --audit-level=high --registry=https://registry.npmjs.org",
  "npm run arch:check",
  "npm run typecheck",
  "npm run test:contract",
  "npm test",
  "npx --yes @redocly/cli@1.34.5 lint contracts/openapi.yaml",
  "npm run test:api",
  "npm run test:db",
  "npm run test:worker",
  "npm run test:query",
  "npm run test:file",
  "npm run test:sample",
  "npm run test:object-storage-live",
  "git diff --check -- contracts docs/testing/verify-matrix.md task.json plans src tests migrations scripts package.json package-lock.json"
)
