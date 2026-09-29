param([switch]$Remove)
$ErrorActionPreference='Stop'
$startup=[Environment]::GetFolderPath('Startup')
$target=Join-Path $startup 'Lahout-Local.vbs'
if($Remove){
 if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target}
 Write-Host 'Lahout sign-in startup removed.'
 exit
}
$launcher=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'Start-Local.ps1'))
$command='powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$launcher+'" -NoBrowser -WaitForNetwork'
$vbs='Set shell = CreateObject("WScript.Shell")'+[Environment]::NewLine+'shell.Run "'+$command.Replace('"','""')+'", 0, False'+[Environment]::NewLine
[IO.File]::WriteAllText($target,$vbs,[Text.Encoding]::Unicode)
Write-Host 'Lahout will start in the background after this Windows user signs in.'
Write-Host 'Logs: project .local/startup and .local/mobile'
