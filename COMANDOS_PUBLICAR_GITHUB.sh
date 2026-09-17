#!/usr/bin/env bash
set -euo pipefail

# Execute este arquivo dentro da pasta raiz do projeto.
# Repositório destino:
# https://github.com/mayconabentes-bi/amazonas-participativa.git

if [ ! -f "package.json" ]; then
  echo "Execute este script dentro da pasta raiz do projeto, onde está o package.json."
  exit 1
fi

if [ ! -d ".git" ]; then
  git init
fi

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/mayconabentes-bi/amazonas-participativa.git

git add .
git commit -m "chore: inicializa projeto Amazonas Participativa"
git push -u origin main

echo "Projeto publicado no GitHub com sucesso."
