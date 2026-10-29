$ErrorActionPreference = 'Stop'
$sdkVersion = '1.0.3912.50'
$vendorDir = Join-Path $PSScriptRoot 'vendor'
$sdkDir = Join-Path $vendorDir 'webview2'
$required = @('lib\net462\Microsoft.Web.WebView2.Core.dll', 'lib\net462\Microsoft.Web.WebView2.WinForms.dll', 'runtimes\win-x64\native\WebView2Loader.dll', 'LICENSE.txt', 'NOTICE.txt')
if (@($required | Where-Object { !(Test-Path -LiteralPath (Join-Path $sdkDir $_)) }).Count -eq 0) { return }
New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
$package = Join-Path $vendorDir "webview2-$sdkVersion.zip"
$uri = "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $uri -OutFile $package -UseBasicParsing
Expand-Archive -LiteralPath $package -DestinationPath $sdkDir -Force
foreach ($relative in $required) {
    if (!(Test-Path -LiteralPath (Join-Path $sdkDir $relative))) { throw "WebView2 SDK is incomplete: $relative" }
}
Write-Host "Restored Microsoft.Web.WebView2 $sdkVersion from NuGet."
