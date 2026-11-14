$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required for this optional launcher.' }
Push-Location -LiteralPath $projectRoot
try {
    & $compiler /nologo /codepage:65001 /target:winexe /reference:System.Windows.Forms.dll (('/win32icon:' + (Join-Path $PSScriptRoot 'game.ico'))) (('/out:' + (Join-Path $projectRoot 'TaoistLegend.exe'))) (Join-Path $PSScriptRoot 'GameLauncher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
    Write-Output 'Built TaoistLegend.exe. Node.js and Chrome/Edge are still required.'
} finally { Pop-Location }
