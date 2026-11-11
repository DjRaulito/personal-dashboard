# Estudio local: monta los vídeos del VoiceStudio en este PC con VoiceStudio (abrir VoiceStudio antes).
# Uso:  .\studio\local.ps1            → espera trabajos de la app y los monta
#       .\studio\local.ps1 demo clone → vídeo de prueba con tu voz (sin la app)
# La primera vez crea el entorno de Python (studio\.venv) con el uv y el Python que trae VoiceStudio.

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $here ".venv"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $python)) {
    $uv = Join-Path $env:LOCALAPPDATA "Programs\VoiceStudio\resources\tools\uv.exe"
    if (-not (Test-Path $uv)) { throw "No encuentro el uv de VoiceStudio en $uv. ¿Está instalado VoiceStudio?" }
    $root = (Get-Content (Join-Path $env:APPDATA "VoiceStudio\runtime-location.json") | ConvertFrom-Json).root
    $base = Get-ChildItem (Join-Path $root ".python") -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($base) { & $uv venv $venv --python $base.FullName } else { & $uv venv $venv --python 3.11 }
    & $uv pip install --python $python -r (Join-Path $here "requirements-local.txt")
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath) { $env:Path = "$env:Path;$userPath" }  # por si ffmpeg se instaló con esta consola abierta
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando ffmpeg con winget..."
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
}

# Capa animada (Remotion): dependencias fijadas en studio\remotion\package-lock.json
$remotion = Join-Path $here "remotion"
if (-not (Test-Path (Join-Path $remotion "node_modules\remotion"))) {
    Write-Host "Instalando Remotion (solo la primera vez)..."
    Push-Location $remotion
    try { npm ci --no-audit --no-fund } finally { Pop-Location }
}

& $python -X utf8 (Join-Path $here "local.py") @args
exit $LASTEXITCODE
