$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'restore-dependencies.ps1')
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\dist" | Out-Null
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/win32icon:$PSScriptRoot\assets\zhiji.ico" /out:"$PSScriptRoot\dist\Zhiji-v13.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/reference:$PSScriptRoot\vendor\webview2\lib\net462\Microsoft.Web.WebView2.Core.dll" "/reference:$PSScriptRoot\vendor\webview2\lib\net462\Microsoft.Web.WebView2.WinForms.dll" /reference:System.Web.Extensions.dll "/resource:$PSScriptRoot\app.html,app.html" "/resource:$PSScriptRoot\folder-images.js,folder-images.js" "/resource:$PSScriptRoot\folder-images.css,folder-images.css" "/resource:$PSScriptRoot\workspace-ui.js,workspace-ui.js" "/resource:$PSScriptRoot\workspace-ui.css,workspace-ui.css" "/resource:$PSScriptRoot\navigation-fonts.js,navigation-fonts.js" "/resource:$PSScriptRoot\navigation-fonts.css,navigation-fonts.css" "/resource:$PSScriptRoot\rich-text.js,rich-text.js" "/resource:$PSScriptRoot\rich-text.css,rich-text.css" "/resource:$PSScriptRoot\inline-toolbar.js,inline-toolbar.js" "/resource:$PSScriptRoot\inline-toolbar.css,inline-toolbar.css" "$PSScriptRoot\DesktopHost.cs" "$PSScriptRoot\NoteWindow.cs" "$PSScriptRoot\StorageLayout.cs" "$PSScriptRoot\DesktopShortcut.cs"
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

foreach ($dependency in @("$PSScriptRoot\vendor\webview2\lib\net462\Microsoft.Web.WebView2.Core.dll","$PSScriptRoot\vendor\webview2\lib\net462\Microsoft.Web.WebView2.WinForms.dll","$PSScriptRoot\vendor\webview2\runtimes\win-x64\native\WebView2Loader.dll")) {
    $destination=Join-Path "$PSScriptRoot\dist" (Split-Path $dependency -Leaf)
    if (!(Test-Path $destination) -or (Get-FileHash $dependency).Hash -ne (Get-FileHash $destination).Hash) { Copy-Item -LiteralPath $dependency -Destination $destination -Force }
}
