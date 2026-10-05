$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

$env:NODE_ENV = "production"
$env:PORT = "7421"

$pm2 = Join-Path $root "node_modules\pm2\bin\pm2"
if (-not (Test-Path $pm2)) {
  throw "PM2 is not installed. From $root run: npm install"
}

$dump = Join-Path $env:USERPROFILE ".pm2\dump.pm2"
if (Test-Path $dump) {
  & node $pm2 resurrect
} else {
  & node $pm2 startOrReload (Join-Path $root "ecosystem.config.cjs") --env production
}

if ($LASTEXITCODE -ne 0) {
  throw "pm2 start/resurrect failed with exit $LASTEXITCODE"
}
