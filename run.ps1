$ErrorActionPreference = "Stop"
$webRoot = Join-Path $PSScriptRoot "web"
$indexFile = Join-Path $webRoot "index.html"

if (-not (Test-Path $indexFile)) {
    throw "The demo page was not found at $indexFile"
}

$node = "node"
if (Test-Path "C:\Users\sarth\nodejs-lts\node.exe") {
    $node = "C:\Users\sarth\nodejs-lts\node.exe"
}

$isRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 8780)
    $tcp.Close()
    $isRunning = $true
} catch {
    $isRunning = $false
}

if (-not $isRunning -and (Test-Path (Join-Path $PSScriptRoot "server.mjs"))) {
    Write-Host "Starting CineVerse server on http://127.0.0.1:8780..."
    Start-Process $node -ArgumentList "server.mjs" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Milliseconds 600
}

Start-Process "http://127.0.0.1:8780/index.html"
Write-Host "CineVerse launched at http://127.0.0.1:8780/index.html"
