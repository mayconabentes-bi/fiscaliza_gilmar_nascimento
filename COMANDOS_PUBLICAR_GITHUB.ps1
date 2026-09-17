# Execute este arquivo dentro da pasta raiz do projeto no PowerShell.
# Repositório destino:
# https://github.com/mayconabentes-bi/amazonas-participativa.git

$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
  Write-Error "Execute este script dentro da pasta raiz do projeto, onde está o package.json."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "Git não encontrado. Instale o Git antes de executar este script."
}

if (-not (Test-Path ".git")) {
  git init
}

git branch -M main

try {
  git remote remove origin 2>$null
} catch {}

git remote add origin https://github.com/mayconabentes-bi/amazonas-participativa.git

git add .
git commit -m "chore: inicializa projeto Amazonas Participativa"
git push -u origin main

Write-Host "Projeto publicado no GitHub com sucesso."
