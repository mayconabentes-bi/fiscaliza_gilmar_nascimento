# Backup externo protegido — FISCALIZE

> Situação: implementação preparada, **não ativada em produção**. Não considerar como backup até a primeira execução COMPLETED/SUCCESS, confirmação do snapshot fora da conta Supabase e ensaio de restauração isolada.

## Escopo da cópia
- PostgreSQL da aplicação: papéis personalizados, definição e dados dos schemas `public` e `private` via CLI oficial do Supabase (não o backup local SQLite).
- Supabase Storage: **todos os objetos do bucket privado de evidências**, incluindo arquivos de pastas internas, manifesto com SHA-256 e propriedades de bucket.
- Os dados passam temporariamente pelo runner efêmero do GitHub Actions e seguem **criptografados pelo restic** a um repositório S3 independente, por exemplo Cloudflare R2 ou AWS S3. Nada é armazenado em commits ou artifacts do GitHub.
- O `supabase db dump` exclui schemas gerenciados, incluindo auth/storage. Para este projeto os usuários cidadãos estão em `public.usuarios` e os assessores em `private.admins`; o backup físico dos objetos e manifesto do bucket é separado. Antes de novos módulos com schemas próprios, ampliar essa cobertura.

## Preparação manual indispensável
1. Criar conta e **bucket privado em provedor separado**, por exemplo Cloudflare R2. Confirmar valores e limites com o provedor; não assumir custo zero. Recomenda-se credencial com acesso exclusivo a esse bucket e histórico/versionamento ou retenção contra deleção.
2. Gerar uma senha exclusiva para restic: `openssl rand -base64 48`. Guardá-la em **dois cofres separados do GitHub e do Supabase**: perdê-la torna os backups irrecuperáveis.
3. No Supabase da **produção**, copiar em `Connect` o URL do **session pooler na porta 5432**, com senha devidamente codificada para URLs, ou o URL direto 5432. O pooler de transação 6543 não é adequado para esse dump. A conexão precisa permitir exportar `public` e `private`.
4. No repositório do GitHub, criar Environment `production-backup` e adicionar os secrets **diretamente na interface**, sem transmiti-los por chat, issues, PR ou logs:

| Secret do Environment | Origem |
| --- | --- |
| `BACKUP_SUPABASE_DB_URL` | URL de backup do PostgreSQL de produção, 5432 |
| `BACKUP_SUPABASE_URL` | URL HTTPS do Supabase de produção |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do projeto de produção; **privilégio elevado** |
| `BACKUP_SUPABASE_EVIDENCE_BUCKET` | Identificador exato do bucket privado de evidências |
| `OFFSITE_RESTIC_REPOSITORY` | Exemplo: `s3:https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com/SEU_BUCKET/fiscalize-prod` |
| `OFFSITE_RESTIC_PASSWORD` | Senha aleatória guardada offline |
| `OFFSITE_S3_ACCESS_KEY_ID` | Credencial do bucket externo, escopo mínimo |
| `OFFSITE_S3_SECRET_ACCESS_KEY` | Segredo do bucket externo, escopo mínimo |

Para Cloudflare R2, Environment variable `OFFSITE_S3_REGION=auto`. Para AWS S3, usar a região real e repositório restic S3 correspondente. A política do Environment e as regras de revisão de workflow devem impedir que código não revisado acesse esses secrets.

5. Revisar o PR, aguardar os testes do job sem secrets e mesclar apenas com a configuração externa pronta. O job com segredos **nunca** é executado em pull requests e só roda a partir de `main`.
6. Em Actions > `External encrypted backup`, executar manualmente `operation=initialize` **uma única vez**; em seguida `operation=backup`. O agendamento diário é **06:20 UTC (02:20 Manaus)**. O job valida o repositório antes de exportar e falha se algum dos itens acima estiver ausente.

**Atenção:** o job não inicializa silenciosamente um repositório durante backups periódicos. Não usar `restic init` em outro prefixo por engano: preservação do histórico depende de manter o mesmo repositório e senha. Não existe exclusão/prune automática nesta primeira fase, até confirmar retenção e recuperação.

## Confirmação após a primeira execução
- O workflow deve terminar verde e mostrar mensagem de exportação do Storage e `restic check` concluído.
- Conferir um snapshot novo no repositório offsite (sem imprimir dados pessoais em logs).
- Realizar **restore fora de produção**. Em uma máquina confiável com `restic`, credenciais de armazenamento externo e senha do cofre: `restic snapshots` e `restic restore latest --target ./recuperacao`.
- Localizar a pasta temporária exportada dentro de `./recuperacao`; entrar na subpasta `db` e executar `sha256sum -c SHA256SUMS`. Validar SHA-256 de cada objeto no `storage/manifest.json` (arquivos físicos ficam em `storage/files/`).
- Restaurar `roles.sql`, `schema.sql` e `data.sql` **apenas em um projeto Supabase novo e isolado ou laboratório local compatível**, seguindo a documentação oficial; ajustar previamente roles/instalação de extensões e não reutilizar a conexão de produção.
- Criar no ambiente de recuperação o bucket privado com as configurações descritas pelo manifesto e reimportar os arquivos via Storage API autenticada. Comparar contagem e SHA-256, executar smoke test de cidadão/assessor e verificar que os arquivos de evidência retornam.
- Registrar data, responsável, tamanho, total de objetos, duração, RPO/RTO medidos e resultado do teste. **Não declarar recuperação comprovada com apenas `restic check`: é preciso restaurar.**

Referências:
- https://supabase.com/docs/guides/deployment/ci/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/storage/management/download-objects
- https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html

## Limitações e bloqueadores para o lançamento
- Backups diários com a CLI e Storage são duas exportações em momentos distintos. Evitar migrations e uploads concorrentes durante o primeiro backup de referência, ou programar uma janela de baixo movimento; não é uma imagem atômica multi-serviço.
- RPO **alvo inicial até 24 horas**, sujeito ao horário da última cópia válida. RTO permanece **desconhecido** até executar recuperação real. Com essa frequência há possibilidade de perda de dados criados após o snapshot.
- Necessário verificar alertas por falha de workflow, capacidade real e dispositivos móveis antes de liberar 300 cidadãos e 50 assessores simultaneamente.
- Segredos do repositório permanecem exclusivamente na interface GitHub; não adicionar `DATABASE_URL` a `.env` versionado.
- A configuração de bootstrap `ADMIN_PASSWORD` na homologação deve ser removida **após a senha ser guardada em cofre**, porque cada redeploy pode redefinir o administrador de teste.
