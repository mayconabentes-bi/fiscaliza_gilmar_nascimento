# P0-D — Persistência de produção

Versão: 2026-09-P0-D

## Arquitetura adotada

Em produção, o FISCALIZE roda como serviço Docker no Railway (migrado da Vercel em 2026-09). O filesystem do container é efêmero e é substituído a cada deploy; por isso o FISCALIZE não deve usar SQLite nem arquivos locais como fonte de verdade.

- Banco transacional: PostgreSQL acessado por `DATABASE_URL`.
- Evidências fotográficas: Supabase Storage por backend, em bucket configurado por `SUPABASE_EVIDENCE_BUCKET`.
- Acesso às evidências: somente backend com credencial de serviço e URL assinada temporária para operação administrativa.
- SQLite: mantido apenas para desenvolvimento, testes e ferramentas locais de compatibilidade.
- Backup SQLite: somente local/teste.

## Fail-closed em produção

Rotas que ainda dependem do legado SQLite não são registradas como funcionalidades normais no runtime de produção. Módulos internos ainda não migrados retornam indisponibilidade até receberem implementação Postgres específica. Isso evita gravação acidental no disco efêmero do container.

O núcleo público já migrado inclui:

- cadastro/login/sessão do cidadão;
- registro e consulta de demandas;
- trilha da versão do aviso de privacidade;
- upload de evidência para Supabase Storage;
- direitos de exportação e exclusão/pseudonimização;
- analytics mobile agregado;
- triagem administrativa de demandas;
- moderação privada de evidências;
- retenção operacional e auditoria dessas ações.

## Readiness

Em produção, `/ready` exige as variáveis:

- `JWT_SECRET`
- `DATABASE_URL`
- `APP_ORIGIN`
- `DPO_CONTACT_EMAIL`
- `LGPD_CONSENT_VERSION`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_EVIDENCE_BUCKET`

Além da presença das variáveis, o endpoint:

1. executa `select 1` no PostgreSQL com TLS;
2. consulta o bucket configurado no Supabase Storage usando a credencial de backend;
3. recusa `ready` se o bucket não existir, estiver inacessível ou tiver `public !== false`.

Assim, o próprio smoke pós-deploy passa a comprovar banco operacional e storage privado antes de considerar a aplicação pronta.

## Estado validado em produção em 2026-09-15

Foi identificado e validado o projeto Supabase de produção efetivamente ligado ao FISCALIZE. A migration P0-D foi aplicada nesse projeto e o histórico local/remoto de migrations foi alinhado.

Validações realizadas no banco de produção:

- RLS ativo nas tabelas públicas críticas do P0-D;
- ausência de grants diretos para `anon` e `authenticated` nessas tabelas;
- schema `private` sem `USAGE` para `anon`/`authenticated`;
- `private.admins` sem privilégios `SELECT`, `INSERT`, `UPDATE` ou `DELETE` para `anon`/`authenticated`;
- dois administradores ativos, sendo um `ADMIN` e um `SUPER_ADMIN`;
- bucket `evidencias-demandas` privado, limitado a 2 MB e aos MIME types `image/jpeg`, `image/png` e `image/webp`;
- nenhuma policy cadastrada em `storage.objects`, portanto sem leitura pública/anônima configurada por policy.

A CI do commit `0163b45` concluiu com sucesso na execução #275. Alterações documentais posteriores exigem nova CI no head final antes do redeploy.

## Backup

O backup de produção não pode ser implementado copiando arquivos dentro do container de hospedagem. O serviço `BackupService` recusa execução quando `NODE_ENV=production`.

O projeto Supabase está atualmente no plano Free. Nesse cenário, o procedimento adotado é manter backup lógico externo do PostgreSQL.

Em 2026-09-15 foi criado e validado um backup lógico externo dos schemas `public` e `private` em formato custom do PostgreSQL. O arquivo foi lido com `pg_restore --list`, confirmando a presença dos objetos esperados, e recebeu hash SHA-256 para verificação de integridade.

O backup lógico do banco não contém os arquivos físicos do Supabase Storage. As quatro evidências atualmente existentes no bucket foram classificadas como dados de teste e não bloqueiam o avanço desta etapa. Antes do início de uso real com evidências, deve ser operacionalizada e testada uma rotina externa de cópia dos objetos do bucket, com verificação de integridade e retenção definida.

### Rotina operacional aprovada

- periodicidade do backup lógico: diária enquanto houver uso real;
- retenção das cópias: 30 dias;
- segunda cópia: obrigatória fora da estação de trabalho, em armazenamento externo com acesso restrito e proteção adequada;
- verificação de integridade: hash SHA-256 do backup e dos objetos físicos quando aplicável;
- teste de restauração: mensal, em ambiente controlado e sem sobrescrever produção;
- Storage real: cópia dos objetos deve acompanhar a mesma rotina diária antes da entrada de evidências reais;
- responsável operacional: `SUPER_ADMIN`, com `ADMIN` como substituto.

## Evidências

O bucket deve permanecer privado. O código não gera URL pública permanente. A visualização administrativa usa URL assinada com expiração curta. Uma evidência nova entra como `PENDENTE`; rejeição remove o objeto do Storage e limpa a referência no banco.

A privacidade do bucket foi validada no painel do Supabase e também é verificada pelo endpoint `/ready`.

## Responsabilidade operacional LGPD e moderação

A operação adotada é:

- responsável operacional primário: perfil `SUPER_ADMIN`;
- substituto operacional: perfil `ADMIN`;
- canal público para solicitações LGPD: endereço configurado em `DPO_CONTACT_EMAIL`;
- escopo: pedidos de acesso, correção, exportação e exclusão/pseudonimização, incidentes de privacidade, revisão de evidências, retenção e registro das decisões;
- continuidade: na indisponibilidade do `SUPER_ADMIN`, o `ADMIN` assume temporariamente a execução operacional;
- frequência ordinária de revisão da fila de moderação: uma vez por dia útil;
- revisão extraordinária: sempre que houver denúncia, suspeita de exposição indevida, risco relevante ou incidente de privacidade.

Essa definição descreve responsabilidade operacional interna e não amplia, por si só, a qualificação jurídica formal do encarregado além do que estiver publicado nos documentos de privacidade.

## Migration

A migration `supabase/migrations/20260915040000_p0d_production_persistence.sql` contém o schema mínimo necessário ao P0-D, RLS e revogações de acesso direto por papéis `anon` e `authenticated`.

Em 2026-09-15 a migration foi aplicada no projeto Supabase correto de produção. O histórico de migrations foi validado como alinhado entre ambiente local e remoto.

## Condição para redeploy

Os bloqueadores técnicos principais de persistência foram encerrados: projeto correto identificado, migration aplicada, controles de acesso validados, bucket privado validado, administrador de produção validado e backup lógico externo inicial criado.

Antes do redeploy final ainda devem ser concluídos:

- confirmação operacional do canal `DPO_CONTACT_EMAIL` como endereço efetivamente monitorado;
- confirmação de `LGPD_CONSENT_VERSION` contra a versão publicada;
- confirmação de domínio/`APP_ORIGIN` do ambiente oficial;
- revisão final de Política de Privacidade e Termos contra a configuração efetiva;
- CI verde no head final;
- execução do redeploy;
- smoke pós-deploy em `/ready`, `/api/public-config` e fluxos críticos.

A rotina de backup físico de evidências reais do Storage permanece requisito obrigatório antes de iniciar uso real desse recurso.
