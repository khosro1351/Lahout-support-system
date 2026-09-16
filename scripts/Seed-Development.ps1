$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$previousPassword = [Environment]::GetEnvironmentVariable('DEV_SEED_PASSWORD', 'Process')
$secret = Read-Host 'Choose a local development password for Aseman (not saved in the repository)' -AsSecureString
try {
    $env:DEV_SEED_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
    if ([string]::IsNullOrWhiteSpace($env:DEV_SEED_PASSWORD)) { throw 'Password cannot be empty.' }
    Push-Location -LiteralPath $repoRoot
    try {
        & pnpm.cmd db:seed:dev
        if ($LASTEXITCODE -ne 0) { throw 'Account seed failed.' }
        & pnpm.cmd db:seed:access:dev
        if ($LASTEXITCODE -ne 0) { throw 'Access request seed failed.' }
        & pnpm.cmd db:seed:guide:dev
        if ($LASTEXITCODE -ne 0) { throw 'Guide seed failed.' }
    } finally { Pop-Location }
} finally {
    [Environment]::SetEnvironmentVariable('DEV_SEED_PASSWORD', $previousPassword, 'Process')
    $secret.Dispose()
}
