# Publicação no GitHub — Amazonas Participativa

Repositório destino:

```txt
https://github.com/mayconabentes-bi/amazonas-participativa.git
```

## Publicação rápida no Windows

1. Extraia o arquivo `amazonas-participativa-github-ready.zip`.
2. Abra o PowerShell dentro da pasta extraída.
3. Execute:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\COMANDOS_PUBLICAR_GITHUB.ps1
```

## Publicação manual

```bash
git init
git branch -M main
git remote add origin https://github.com/mayconabentes-bi/amazonas-participativa.git
git add .
git commit -m "chore: inicializa projeto Amazonas Participativa"
git push -u origin main
```

## Observação técnica

O arquivo `civic_platform.db.corrupted` foi removido deste pacote de publicação porque estava corrompido e não deve ser versionado.

A `.gitignore` foi reforçada para bloquear `.env`, bancos locais, arquivos temporários, logs, `node_modules`, `dist` e `build`.
