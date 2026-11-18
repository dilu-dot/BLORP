param(
  [ValidateSet("balanced","light")]
  [string]$Edition = "balanced"
)
$ErrorActionPreference="Stop"
$command = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $command) {
  Write-Host "Ollama is not installed. Download it from https://ollama.com/download/windows"
  exit 1
}
$base = if ($Edition -eq "light") { "qwen2.5-coder:1.5b" } else { "qwen3.5:4b" }
Write-Host "Blorp uses $base. Downloading weights into your local Ollama data folder..."
& ollama pull $base
if ($LASTEXITCODE -ne 0) { throw "Ollama pull failed" }
$modelfile = Join-Path $PSScriptRoot "..\models\blorp\Modelfile"
$temp = $null
try {
  if ($Edition -eq "light") {
    $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("BlorpModelfile-" + [guid]::NewGuid() + ".txt")
    $content = Get-Content $modelfile -Raw
    $content = $content.Replace("FROM qwen3.5:4b", "FROM qwen2.5-coder:1.5b")
    [System.IO.File]::WriteAllText($temp, $content)
    $modelfile = $temp
  }
  Write-Host "Creating Blorp in local Ollama..."
  & ollama create blorp -f $modelfile
  if ($LASTEXITCODE -ne 0) { throw "Ollama create failed" }
  Write-Host "Done. Open Blorp AI Desktop > Model Hub > Refresh models."
  & ollama list
} finally {
  if ($temp -and (Test-Path $temp)) { Remove-Item $temp -Force }
}
