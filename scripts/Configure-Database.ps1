param(
    [string]$DatabaseHost = '127.0.0.1',
    [int]$DatabasePort = 5432,
    [string]$DatabaseName = 'lahout_dev',
    [string]$DatabaseUser = 'lahout_dev'
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $repoRoot '.env'
if (Test-Path -LiteralPath $destination) {
    throw '.env already exists. Edit it locally; this helper never overwrites existing settings.'
}
$secret = Read-Host 'Enter the local PostgreSQL password (written only to ignored .env)' -AsSecureString
try {
    $password = [Net.NetworkCredential]::new('', $secret).Password
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'Database password cannot be empty.' }
    $dbUrl = 'postgres://{0}:{1}@{2}:{3}/{4}' -f [Uri]::EscapeDataString($DatabaseUser), [Uri]::EscapeDataString($password), $DatabaseHost, $DatabasePort, [Uri]::EscapeDataString($DatabaseName)
    $template = [IO.File]::ReadAllText((Join-Path $repoRoot '.env.example'))
    $content = [regex]::Replace($template, '(?m)^DATABASE_URL=.*$', ('DATABASE_URL=' + $dbUrl))
    [IO.File]::WriteAllText($destination, $content, [Text.UTF8Encoding]::new($false))
    Write-Host 'Local .env created. Its contents are not printed and must not be committed.'
} finally {
    $password = $null
    $dbUrl = $null
    $content = $null
    $secret.Dispose()
}
