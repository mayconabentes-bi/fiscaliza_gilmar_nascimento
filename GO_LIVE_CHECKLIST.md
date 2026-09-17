# Sprint P0 — Go Live

Este checklist define as condições mínimas antes de habilitar cadastro cidadão real.

## Implementado neste sprint

- [x] Backup do banco real `civic_platform.db` com `integrity_check`, SHA-256 e restore testado.
- [x] Suporte a cópia externa de backup via `BACKUP_EXTERNAL_DIR`.
- [x] Configuração obrigatória de produção validada no startup.
- [x] CORS restrito a `APP_ORIGIN`.
- [x] Proteção contra operações mutáveis vindas de origem não confiável.
- [x] Gemini API key removida do bundle Vite.
- [x] SQLite com `foreign_keys`, WAL e `busy_timeout` em toda conexão.
- [x] CPF protegido antes de persistência com HMAC usando `CPF_PEPPER`.
- [x] Aceite LGPD e Código Cívico obrigatórios no backend.
- [x] Registro da versão do consentimento.
- [x] `/health` e `/ready`.
- [x] Smoke tests de produção e teste real de backup/restore.
- [x] Dockerfile de produção.
- [x] Docker Compose com volume persistente.
- [x] Caddy com HTTPS automático para domínio válido.
- [x] Serviço diário de backup para diretório externo montado.
- [x] Cadastro público desabilitado por padrão.

## Antes de colocar cidadãos reais

1. Copiar `.env.example` para `.env` fora do controle de versão.
2. Gerar `JWT_SECRET` e `CPF_PEPPER` independentes e aleatórios, com pelo menos 32 caracteres.
3. Definir `DOMAIN`, `APP_ORIGIN` e `APP_URL` para o domínio real.
4. Definir contato real do controlador/encarregado de privacidade.
5. Revisar juridicamente a política de privacidade, bases legais e prazos de retenção.
6. Garantir que o diretório `./backups` seja replicado para armazenamento fora do host (bucket, NAS ou storage equivalente).
7. Executar um restore de homologação a partir do backup externo.
8. Confirmar DNS apontando para o host e HTTPS válido no Caddy.
9. Criar o primeiro administrador por processo seguro e trocar credenciais temporárias.
10. Verificar `/health` e `/ready` após deploy.
11. Confirmar CI verde na revisão que será implantada.
12. Somente após estes passos alterar `ENABLE_PUBLIC_REGISTRATION=true` e reiniciar o serviço.

## Implantação sugerida

```bash
cp .env.example .env
# preencher segredos, domínio e contatos reais
mkdir -p backups
docker compose -f docker-compose.production.yml up -d --build
curl https://SEU_DOMINIO/health
curl https://SEU_DOMINIO/ready
```

O volume `app_data` mantém o SQLite de forma persistente. O diretório local `./backups` recebe uma segunda cópia diária; em produção ele deve ser sincronizado para armazenamento independente do servidor.

## Política de abertura

Enquanto `ENABLE_PUBLIC_REGISTRATION=false`, o backend rejeita novos cadastros cidadãos em produção. Essa trava existe para impedir coleta prematura de dados pessoais antes da conclusão jurídica e operacional do go-live.
