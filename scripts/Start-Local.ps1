param([switch]$NoBrowser, [switch]$NoLan, [switch]$RequireLan, [switch]$WaitForNetwork)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localWork = [IO.Path]::GetFullPath((Join-Path $repo '..\..\work'))
$logDir = Join-Path $repo '.local\startup'
$lock = $null

function Test-Port([int]$Port) {
    $tcp = New-Object Net.Sockets.TcpClient
    try {
        $pending = $tcp.ConnectAsync('127.0.0.1', $Port)
        if (!$pending.Wait(800)) { return $false }
        return $tcp.Connected
    } catch { return $false } finally { $tcp.Dispose() }
}

function Test-Ready([string]$Url) {
    try {
        $r = Invoke-RestMethod -Uri $Url -TimeoutSec 3
        return ($r.status -eq 'ready' -and $r.postgres -eq 'ok')
    } catch { return $false }
}

function Start-App([string]$Name, [int]$Port, [string]$HealthUrl) {
    if (Test-Port $Port) {
        if (!(Test-Ready $HealthUrl)) { throw "Port $Port is occupied but $Name is not healthy. Close the conflicting application and retry." }
        Write-Host "$Name is already ready."
        return
    }
    $child = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $bridge + '"'), $Name) -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$Name.out.log") -RedirectStandardError (Join-Path $logDir "$Name.err.log")
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        if (Test-Ready $HealthUrl) { Write-Host "$Name is ready."; return }
        if ($child.HasExited) { throw "$Name stopped during startup. See $logDir\$Name.err.log" }
        Start-Sleep -Seconds 1
    }
    throw "$Name did not become ready. See $logDir"
}

try {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    # Exclusive handle prevents duplicate services from simultaneous double-clicks.
    try { $lock = [IO.File]::Open((Join-Path $logDir 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw 'Another launcher is running. Please wait for it to finish.' }
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (!$nodeCommand) { throw 'Node.js 24 was not found. Install Node.js 24, then run this file again.' }
    $nodeExe = $nodeCommand.Source
    $version = & $nodeExe --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v24\.') { throw 'This project requires Node.js 24.' }
    foreach ($file in @('.env', 'apps\backend\dist\main.js', 'apps\frontend\dist\index.html', 'node_modules\.modules.yaml')) {
        if (!(Test-Path -LiteralPath (Join-Path $repo $file))) { throw "Required file missing: $file. See docs\LOCAL_STARTUP_FA.txt. No data was changed." }
    }
    $bridge = Join-Path $PSScriptRoot 'local-runtime.mjs'
    $configText = & $nodeExe $bridge config
    if ($LASTEXITCODE -ne 0) { throw 'Local configuration could not be read. Check the existing .env file.' }
    $config = $configText | ConvertFrom-Json
    Write-Host 'Starting Lahout local application...'
    if (!(Test-Port $config.dbPort)) {
        # Reuse this workstation's portable cluster. Never initialize or seed it.
        $pgBin = Join-Path $localWork 'node_modules\@embedded-postgres\windows-x64\native\bin'
        $postgresExe = Join-Path $pgBin 'postgres.exe'
        $dataDir = Join-Path $localWork 'pgdata'
        if ($config.dbPort -ne 55432 -or !(Test-Path -LiteralPath $postgresExe) -or !(Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
            throw "PostgreSQL is not running on port $($config.dbPort). Start your existing PostgreSQL service, then retry. Do not create a new database."
        }
        Write-Host 'Waiting for the existing local database...'
        $pgChild = Start-Process -FilePath $postgresExe -ArgumentList @('-D', ('"' + $dataDir + '"'), '-p', '55432', '-h', '127.0.0.1') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'postgres.out.log') -RedirectStandardError (Join-Path $logDir 'postgres.err.log')
        $databaseReady = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            & $nodeExe $bridge database --quiet
            if ($LASTEXITCODE -eq 0) { $databaseReady = $true; break }
            if ($pgChild.HasExited) { break }
            Start-Sleep -Seconds 1
        }
        if (!$databaseReady) { throw "PostgreSQL could not start. See $logDir\postgres.err.log" }
    }
    & $nodeExe $bridge database
    if ($LASTEXITCODE -ne 0) { throw 'Database connection failed. Check the existing .env configuration. No database was reset.' }
    Write-Host 'Database connection is ready.'
    Start-App 'backend' $config.port "http://127.0.0.1:$($config.port)/api/v1/health/ready"
    Start-App 'frontend' $config.previewPort "http://127.0.0.1:$($config.previewPort)/api/v1/health/ready"
    $loginUrl = "$($config.origin)/login"
    $login = Invoke-WebRequest -Uri $loginUrl -UseBasicParsing -TimeoutSec 10
    if ($login.StatusCode -ne 200 -or $login.Content -notmatch '<div id="root">') { throw 'The login page did not load correctly.' }
    Write-Host "READY: $loginUrl" -ForegroundColor Green
    Write-Host 'You can close this window. Run Start-Lahout.cmd again after restarting Windows.'
    if (!$NoLan) {
        if ($WaitForNetwork) {
            for ($networkAttempt = 0; $networkAttempt -lt 30; $networkAttempt++) {
                $networkInfo = & $nodeExe (Join-Path $PSScriptRoot 'mobile-lan.mjs') status 2>$null
                if ($networkInfo -match 'Private adapters: .+') { break }
                Start-Sleep -Seconds 2
            }
        }
        & $nodeExe (Join-Path $PSScriptRoot 'mobile-lan.mjs') start
        if ($LASTEXITCODE -ne 0) {
            if ($RequireLan) { throw 'Desktop is ready, but LAN could not start. See .local/mobile/gateway.log.' }
            Write-Warning 'Desktop is ready; LAN is unavailable. Connect to Wi-Fi and run Start-Mobile.cmd.'
        }
    }
    if (!$NoBrowser) { Start-Process $loginUrl }
} catch {
    Write-Host "STARTUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Startup logs: $logDir"
    exit 1
} finally {
    if ($lock) { $lock.Dispose() }
}
