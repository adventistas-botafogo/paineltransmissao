# Gera "Overlays Igreja.zip" para levar ao PC da transmissão.
# Uso (no notebook):  powershell -ExecutionPolicy Bypass -File "overlays OBS\pacote\gerar-pacote.ps1"
$ErrorActionPreference = "Stop"
$aqui   = $PSScriptRoot                       # overlays OBS\pacote
$origem = Split-Path $aqui -Parent            # overlays OBS
$saida  = Join-Path (Split-Path $origem -Parent) "pacote igreja"
$tmp    = Join-Path $env:TEMP "overlays-igreja-pacote"
$raiz   = Join-Path $tmp "Overlays Igreja"

Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $raiz | Out-Null

# o que o painel precisa para rodar
foreach ($p in "painel", "html", "obs-cli", "logo") {
  Copy-Item (Join-Path $origem $p) $raiz -Recurse
}
# preview.html e LEIA-ME são de desenvolvimento; o arquivo vivo das listas nunca vai no pacote
Remove-Item (Join-Path $raiz "html\preview.html") -ErrorAction SilentlyContinue
$dados = Join-Path $raiz "painel\dados"
if (Test-Path "$dados\predefinicoes.json") { Move-Item "$dados\predefinicoes.json" "$dados\predefinicoes-inicial.json" -Force }

# atalhos, guia, versão e histórico na raiz
Copy-Item (Join-Path $aqui "*.bat"), (Join-Path $aqui "COMO INSTALAR.txt"), (Join-Path $origem "versao.json"), (Join-Path $origem "HISTORICO.md") $raiz
$versao = (Get-Content (Join-Path $origem "versao.json") -Raw | ConvertFrom-Json).versao

# Node portátil (o mesmo executável instalado neste notebook)
$node = (Get-Command node).Source
New-Item -ItemType Directory -Force (Join-Path $raiz "node") | Out-Null
Copy-Item $node (Join-Path $raiz "node\node.exe")

New-Item -ItemType Directory -Force $saida | Out-Null
$zip = Join-Path $saida "Overlays Igreja v$versao.zip"
Remove-Item $zip -ErrorAction SilentlyContinue
# tar.exe do Windows gera zip padrão (o Compress-Archive do PowerShell 5 grava caminhos com "\")
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $tmp "Overlays Igreja"
if ($LASTEXITCODE) { throw "tar falhou ($LASTEXITCODE)" }
Remove-Item $tmp -Recurse -Force

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Pacote v$versao gerado: $zip ($mb MB) com Node $(& $node -v)"
