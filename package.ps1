$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$distDir = Join-Path $PSScriptRoot 'dist'
$stage = Join-Path $distDir ('package-' + [Guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $stage 'Zhiji-Windows'
$programDir = Join-Path $packageRoot '程序文件'
New-Item -ItemType Directory -Force -Path $programDir, (Join-Path $packageRoot '我的笔记'), (Join-Path $packageRoot '缓存') | Out-Null
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/win32icon:$PSScriptRoot\assets\zhiji.ico" "/out:$packageRoot\枝记.exe" "$PSScriptRoot\ProgramLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher build failed' }
# Explicit allowlist: never copy an existing installation or personal data.
foreach ($name in @('Zhiji-v13.exe', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll')) {
    Copy-Item -LiteralPath (Join-Path $distDir $name) -Destination $programDir
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'assets\zhiji.ico') -Destination (Join-Path $programDir '枝记.ico')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vendor\webview2\LICENSE.txt'), (Join-Path $PSScriptRoot 'vendor\webview2\NOTICE.txt') -Destination $programDir
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README-v13.txt') -Destination (Join-Path $packageRoot '使用说明.txt')
$zip = Join-Path $distDir 'Zhiji-Windows.zip'
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zip -Force
Write-Host "Package: $zip"
