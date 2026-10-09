# FISCALIZE — preparação GitHub Actions + Cloudflare R2 (sem produção)
Data do plano: 2026-10-09. Responsável pela aprovação: proprietário do FISCALIZE.

## Decisão operacional
- Hoje: apenas documentação, revisão de código e testes sintéticos. **Não acessar Supabase de produção, não criar bucket, não configurar secrets e não enviar dados.**
- Próxima sessão (2026-10-10): executar diagnóstico supervisionado da estratégia de backup PostgreSQL, habilitar proteção das credenciais e, após aprovação explícita, produzir primeira cópia cifrada e testar recuperação **isolada**.
- Railway: plataforma de produção prioritária; Vercel permanece secundária. Não utilizar o compartilhamento SMB S: nem o servidor 192.168.30.222 para backup.
- Sem merge, deploy, workflow agendado, escrita em banco ou alteração das configurações de produção nesta fase.

## Arquitetura-alvo (a validar amanhã)
1. PostgreSQL do Supabase de produção (projeto ref `jnlfmiwczpglojqytrbw`), conexão SSL e sessão **5432**, credencial específica com privilégio mínimo suficiente para `pg_dump`. Confirmar permissões de leitura, isolamento e carga de execução sem conceder privilégios desnecessários.
2. GitHub Actions, execução manual `workflow_dispatch` inicialmente, Linux efêmero, `permissions: contents: read`, tempos e concorrência limitados, sem eventos `pull_request`/fork com acesso a secrets. Usar **Environment** exclusivo de backup com restrição de branches e aprovação por responsável antes de liberar secrets; proibir exibição de dados em logs e publicação de artifacts com PII.
3. Fluxo em streaming `pg_dump --format=custom` -> cifragem `age` para **chave pública** -> upload de artefato **cifrado** ao bucket privado Cloudflare R2. **Nunca** armazenar dump em claro no workspace, em Actions Artifacts, em logs ou no repositório. O `age` do runner Linux deve ter versão e origem verificadas. Não depende do `age.exe` bloqueado por App Control no computador Windows.
4. R2: bucket privado dedicado, sem domínio público, acesso via credencial limitada ao bucket e operações necessárias. Conferir namespace, endpoints e permissões antes do primeiro upload. Não colocar token R2, URL com senha, credenciais PostgreSQL ou chave age privada em arquivos rastreados ou na conversa. Chave privada para restauração sob custódia offline separada do R2 e do GitHub.
5. Evidências: planejar **segundo backup** dos objetos binários de Supabase Storage. Os metadados do banco não restauram as fotos; APIs/permissões e paginação de Storage precisam de desenho e testes separados. Não usar bucket de evidências públicas para armazenar cópias do backup.
6. Produção do FISCALIZE no Railway **não** depende do serviço de backup; falhas de backup devem gerar alerta e bloquear a conclusão de readiness, sem reiniciar/alterar a aplicação.

## Limites conhecidos
- O script existente `scripts/backup_postgres_encrypted.py` (PR #98) abrange **apenas** schemas `public` e `private`: ainda NÃO é imagem completa de um projeto Supabase. Revisar `auth`, `storage`, extensões, roles e demais configurações de projeto. Não prometer restauração completa antes de validar o alcance.
- Um êxito de `pg_dump`, de upload ou de SHA-256 **não substitui teste real de `pg_restore` em ambiente isolado**. Validar schema, contagens, relações, políticas RLS, anexos e acesso da aplicação em base restaurada.
- Supabase Free pode não incluir backups gerenciados; plano de nuvem e limites gratuitos precisam ser confirmados nas contas antes de gerar custo.
- Nenhum secret deve ficar disponível a PRs ou workflows editáveis por colaboradores não autorizados. Revisão de supply-chain, permissões das Actions e proteção do Environment são pré-condições de implantação.
- **Jamais ativar retenção que apaga backups** antes de confirmar primeira restauração e aprovação da política de rotação. Proposta inicial a discutir: 7 diários + 4 semanais e teste periódico, de acordo com espaço e custo.

## Checklist para a próxima sessão
- [ ] Confirmar conta Cloudflare, disponibilidade da franquia e estimativa de tamanho/volume (sem dados pessoais).
- [ ] Criar bucket R2 **privado** e acesso de privilégio mínimo com controle de custos; nenhuma configuração sensível exposta.
- [ ] Gerar e custodiar chave **privada** de recuperação fora do repositório/GitHub; colocar somente chave **pública** no pipeline.
- [ ] Preparar GitHub Environment protegido, secrets de escopo estrito e gatilho **manual** inicial, com revisão antes de habilitar.
- [ ] Conferir PostgreSQL de produção no Supabase com consultas somente leitura e confirmar quais schemas/objetos necessitam de backup; nunca executar alterações.
- [ ] Implementar e testar workflow **sinteticamente** em PR isolado, incluindo falha-fechada, redaction, integridade e política de upload.
- [ ] Com autorização específica, executar cópia cifrada, validar checksum e inventário; separar backup do Storage.
- [ ] Descriptografar com a chave custodiada e realizar **restauração real em PostgreSQL isolado**; registrar evidências não sensíveis.
- [ ] Somente depois, deliberar retenção, agenda, alerta de falhas e aptidão para produção.

## Estado verificável ao final de hoje
`R2_CONFIGURADO=NAO`
`CREDENCIAIS_LIDAS=NAO`
`BACKUP_EXECUTADO=NAO`
`PRODUCAO_ACESSADA=NAO`
`WORKFLOW_AGENDADO=NAO`
`RESTAURACAO_VALIDADA=NAO`
`RELEASE_BLOQUEADO_POR_BACKUP=PENDENTE`

A mudança é propositalmente **somente documentação**, nesta branch **draft** do PR #98. Nenhum arquivo de workflow com acesso a produção foi criado.
