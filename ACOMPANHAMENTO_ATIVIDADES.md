# FISCALIZE — Acompanhamento de atividades

**Início:** 09/10/2026 (Manaus/AM)  
**Objetivo:** preparar a plataforma para uso progressivo por 300 cidadãos e 50 assessores, preservando a segurança dos dados e a continuidade do serviço.  
**Situação geral:** EM ANDAMENTO — ampliação de produção ainda **não autorizada**.  
**Responsável:** desenvolvimento e validação técnica do FISCALIZE.

> Este documento é o registro vivo do trabalho. Marcar uma tarefa com `[x]` **somente após executar a verificação e registrar a evidência**. Um CI verde, isoladamente, não autoriza o lançamento. O arquivo não se atualiza sozinho: cada conclusão deve resultar em alteração versionada e revisada neste Markdown.

## Como manter o registro

1. Deixar `- [ ]` enquanto o item estiver pendente; usar `- [x]` apenas quando concluído e verificado.
2. Adicionar data (horário de Manaus), resultado e link/identificador de evidência no **Diário de execução**.
3. Quando a atividade exigir correção, trabalhar em branch/PR e executar testes na **homologação isolada** antes de propor produção.
4. Não registrar senhas, tokens, dados pessoais, dumps reais ou informações sensíveis nos commits, PRs e logs.
5. Distinguir **aprovado em testes**, **validado em homologação** e **validado em produção**. Não tratar um como equivalente ao outro.
6. No fim de cada sessão, atualizar progresso e próximos passos. Para marcar itens durante nossas conversas, solicitar explicitamente: **"Atualize o acompanhamento do FISCALIZE com o que concluímos"**.

## Referências já verificadas (não são liberação operacional)

- [x] GitHub `main` no commit `e51ef50` e CI concluído com `success` em 05/10/2026. Evidência: [CI da main](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37256427911).
- [x] Railway produção em `SUCCESS` para o mesmo commit `e51ef50`, verificado em 09/10/2026 via painel/API de deploys.
- [x] Ambientes Railway de produção e homologação identificados como separados; os commits publicados são diferentes, conferidos em 09/10/2026.
- [x] Metadados do Supabase consultados em 09/10/2026: produção apresentava 21 usuários cidadãos, 11 registros de contas internas e 71 demandas (contagens estimadas do inventário, não verificação de integridade).
- [x] Teste sintético de login em IP compartilhado incluído no CI: 50/50 logins sequenciais aprovados; cadastro público ainda limita 10/h por IP e bloqueou 5 de 15 registros sintéticos. Evidência: [PR #91](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/91). **Não comprova concorrência em PostgreSQL.**

## P0 — Segurança e continuidade (executar primeiro)

### A00 — Corrigir dependências vulneráveis identificadas no CI
**Estado:** PENDENTE | **Prioridade:** P0 — NOVO BLOQUEADOR

- [x] Identificar os alertas que fazem o CI falhar: `proxy-addr` 2.0.7 (CRITICAL, corrigido em 2.0.8) e `source-map-js` 1.2.1 (HIGH, corrigido em 1.2.2), em 09/10/2026. Evidência: [CI](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37946385763) e [issue #94](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/issues/94).
- [x] Confirmar no lockfile as origens: `express` → `proxy-addr`; `postcss`/`@tailwindcss/node` → `source-map-js`.
- [x] Abrir [PR #95](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/95), branch separada da `main`, alterando **somente** `package-lock.json` nas entradas de `proxy-addr` 2.0.8 e `source-map-js` 1.2.2; diff de 6 linhas adicionadas e 6 removidas (09/10/2026).
- [x] Verificar `npm ci`, TypeScript, build e `npm run audit:high` em ambos os jobs do [CI #37948199475](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199475) — etapas aprovadas; [Visual QA #37948199334](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199334) SUCCESS.
- [x] Confirmar resultado final dos dois jobs do [CI #37948199475](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199475): ambos `success`, incluindo Deep QA; [Visual QA #37948199334](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199334) também `success` (09/10/2026).
- [ ] Homologar, revisar impacto do rate limiting e definir rollback antes de qualquer promoção a produção.

**Critério de conclusão:** CI integralmente verde com versões corrigidas, homologação verificada e aprovação para publicar; a vulnerabilidade reportada no pacote não prova, por si só, exploração no projeto.  
**Aprendizado:** dependências indiretas também afetam a segurança; a correção precisa ser pequena, reproduzível e testada.


### A01 — Auditar segurança do Supabase
**Estado:** PENDENTE | **Prioridade:** P0

- [x] Consultar privilégios SQL e grants efetivos dos papéis `anon`/`authenticated` para `private.setores` e `private.setor_categorias` (09/10/2026: sem USAGE no schema e sem SELECT/INSERT/UPDATE/DELETE nas duas tabelas). **Acesso funcional pela API ainda pendente.**
- [x] Analisar exposição por privilégios do catálogo PostgreSQL: `anon` e `authenticated` não possuem `SELECT` em nenhuma das tabelas do schema `private` consultadas; nenhuma função de setor com `SECURITY DEFINER` e `EXECUTE` público foi encontrada no inventário filtrado (09/10/2026).
- [x] Revisar proteção das rotas no código `main`: middleware `requireInternalAccess` obrigatório sob `/api/admin`, revalidação da conta ativa no Postgres e lista fechada para perfis setoriais; listagem de equipe fora do escopo de assessor.
- [x] Verificar catálogo `pg_roles.rolconfig` do `authenticator`: sem override local de `pgrst.db_schemas` em 09/10/2026. **Isto não revela a lista efetiva dos schemas publicados pelo painel.**
- [x] Executar GET sem autenticação em produção para `/api/admin/equipe`, `/api/admin/demandas`, `/api/admin/audit`: todos responderam HTTP 401 (09/10/2026). Evidência: [workflow HTTP somente leitura](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37946872319).
- [ ] Confirmar a lista efetiva dos schemas expostos na Data API Supabase e a resposta HTTP para `private.setores` com **chave pública apropriada**, sem divulgar credenciais nem consultar dados pessoais.
- [x] Comparar estado RLS produção/homologação (09/10/2026: desligado nas duas tabelas em produção; ligado em homologação; sem políticas detectadas na consulta de produção).
- [ ] Revisar a necessidade e desenho de RLS nessas tabelas; **não habilitar RLS nem criar policies sem ensaio e plano de retorno**.
- [ ] Testar acesso negado com identidades não autorizadas e isolamento entre setores, sem usar dados pessoais reais.
- [ ] Registrar achados, decisões e evidências, sem imprimir segredos.

**Critério de conclusão:** acessos efetivos demonstrados, políticas/grants revisados, nenhum acesso indevido e evidência de testes em homologação.  
**Aprendizado:** RLS filtra linhas; `GRANT` controla privilégios SQL; a exposição de schemas pela Data API é uma terceira camada.  
**Observação:** o inventário Supabase apresentou alerta crítico de RLS desabilitado nessas duas tabelas; exposição efetiva precisa ser comprovada.

### A02 — Verificar saúde da produção Railway
**Estado:** PENDENTE | **Prioridade:** P0

- [x] Testar status HTTP de `/health` e `/ready` na produção via runner GitHub: ambos HTTP 200 em 09/10/2026. Evidência: [workflow HTTP](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37946872319).
- [ ] Verificar corpo de `/ready` e eventual estado degradado do Supabase Storage, sem registrar dados sensíveis.
- [ ] Analisar logs recentes após o deploy atual e confirmar ausência de falhas recorrentes do scheduler SQLite legado.
- [ ] Verificar erros HTTP 5xx, tempo de resposta e disponibilidade sem executar carga em produção.
- [ ] Registrar commit implantado, diagnóstico e procedimento de rollback.

**Critério de conclusão:** endpoints e logs verificados, anomalias triadas, implantação rastreável e rollback definido.  
**Aprendizado:** `/health` sinaliza processo vivo; `/ready` valida dependências, mas não substitui E2E.

### A03 — Verificar backup e restauração
**Estado:** PENDENTE | **Prioridade:** P0

- [ ] Conferir a execução mais recente do backup PostgreSQL e as evidências de retenção.
- [ ] Conferir cobertura das evidências do bucket privado Supabase Storage e itens não cobertos (Auth/configuração, se aplicável).
- [ ] Confirmar criptografia, acesso restrito, cópia fora do computador principal e integridade dos artefatos.
- [ ] Ensaiar restauração em PostgreSQL/Storage **isolados**, sem sobrescrever produção.
- [ ] Registrar RPO, RTO, responsável e procedimento de recuperação.

**Critério de conclusão:** restauração íntegra reproduzida, lacunas documentadas e cópia protegida.  
**Aprendizado:** um backup sem restore demonstrado não comprova capacidade de recuperação.

## P0 — Cadastro e equipe (após os controles anteriores)

### A04 — Revisar PRs de cadastro
**Estado:** PENDENTE | **Prioridade:** P0

- [ ] Revisar [PR #84](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/84) (contratos de cadastro/login).
- [ ] Revisar [PR #92](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/92) (cadastro presencial por convite).
- [ ] Conferir antifraude, expiração/uso único do convite, limites de emissão, consentimento e concorrência.
- [ ] Revalidar diff contra `main` atualizada, executar CI e E2E em homologação antes de qualquer merge.

**Critério de conclusão:** PRs revisados, testes documentados e decisão fundamentada de merge ou correção.  
**Aprendizado:** PR isola mudanças e permite revisão; testes verdes da branch não substituem homologação.

### A05 — Testar cadastro com rede compartilhada
**Estado:** PENDENTE | **Prioridade:** P0

- [ ] Testar cadastro/login/logout com dados sintéticos e limpeza comprovada na homologação PostgreSQL.
- [ ] Reproduzir IP compartilhado, HTTP 429 e recuperação de erros sem eliminar defesa contra abuso.
- [ ] Simular 300 cadastros fictícios em lotes controlados; medir p95, taxas de erro, CPU/memória e conexões.
- [ ] Ensaiar reenvio idempotente, perda de conexão e interrupção durante upload.
- [ ] Definir critérios objetivos de aprovação e parada da simulação.

**Critério de conclusão:** 300 cadastros sintéticos ensaiados com métricas e sem violações de isolamento, integridade ou limites acordados.  
**Aprendizado:** NAT permite que muitos dispositivos compartilhem IP; limite antiabuso deve distinguir tráfego legítimo de automação.

### A06 — Validar os acessos dos assessores
**Estado:** PENDENTE | **Prioridade:** P0

- [ ] Testar contas fictícias por papel/setor na homologação (SUPER_ADMIN, ADMIN, COORDENADOR, ATENDENTE, conforme configuração).
- [ ] Comprovar que assessor de um setor não lê/altera demandas ou evidências privadas de outro.
- [ ] Testar desativação, revogação de sessão, recuperação segura de acesso e privilégio mínimo.
- [ ] Ensaiar 50 logins, inclusive na mesma rede e concorrentes, com métricas e anti-brute-force mantido.

**Critério de conclusão:** matriz de RBAC aprovada em testes de API e navegador, sem acesso cruzado.  
**Aprendizado:** RBAC organiza permissões por papéis, e o setor restringe o escopo concreto de cada conta.

## P1 — Experiência, operação e lançamento

### A07 — Testar experiência de campo e PWA
**Estado:** PENDENTE | **Prioridade:** P1

- [ ] Testar Android Chrome e iOS Safari em dispositivos reais.
- [ ] Validar CEP/bairro, acessibilidade, teclado, fotos e limites de upload.
- [ ] Verificar comportamento online/offline, perda de sinal e feedback ao cidadão.
- [ ] Não prometer envio offline sem fila idempotente testada e tratamento seguro de dados.

**Critério de conclusão:** roteiro mobile registrado com evidências e problemas P0 resolvidos.  
**Aprendizado:** PWA melhora experiência de instalação, mas não garante sincronização de envios offline.

### A08 — Planejar liberação progressiva
**Estado:** PENDENTE | **Prioridade:** P1

- [ ] Testar recuperação de senha e entregabilidade de e-mails.
- [ ] Confirmar alertas, observabilidade, canal de incidentes, LGPD e instruções para operadores.
- [ ] Revisar documentação de produção ainda baseada em SQLite (ex.: `GO_LIVE_CHECKLIST.md`) à luz de PostgreSQL/Supabase.
- [ ] Preparar decisão **go/no-go** e rollout de 30 cidadãos/5 assessores → 120/20 → 300/50, com critérios de parada.
- [ ] **Somente após aprovações P0 e autorização explícita:** planejar ativação ou ampliação na produção.

**Critério de conclusão:** plano de lançamento assinado, suporte e retorno definidos, nenhum bloqueador P0 em aberto.  
**Aprendizado:** rollout gradual limita o impacto de falhas e permite medir capacidade com risco controlado.

## Diário de execução

| Data (Manaus) | Atividade | Ação/resultado | Evidência | Próximo passo |
|---|---|---|---|---|
| 09/10/2026 | Diagnóstico inicial | CI da `main`, deploy correspondente e inventário Supabase verificados; riscos e testes de escala ainda pendentes | CI 37256427911; PR #91; inventário de tabelas | Começar A01 com leitura dos privilégios e desenho de RLS |
| 09/10/2026 | A01 — auditoria adicional sem mutações | Os papéis públicos não possuem `SELECT` nas tabelas do schema `private` consultadas; código exige autenticação e autorização backend para `/api/admin` e delimita rotas de setor. Teste HTTP não executado/concluído por impossibilidade de alcançar o endereço da aplicação nesta sessão (falha DNS no ambiente de execução); configuração da Data API não confirmada. | Catálogo de `pg_class`, `pg_proc`, `has_table_privilege` e arquivos `app.ts`, `internalAccess.ts`, `teamManagementRoutes.ts`, `adminAccessPolicy.ts` | Realizar teste HTTP sem credenciais e verificar schemas expostos; manter A01 aberta |
| 09/10/2026 | A01 — levantamento SQL somente leitura | Produção: `private.setores` e `private.setor_categorias` sem RLS, mas `anon`, `authenticated`, `authenticator` e `service_role` não têm USAGE no schema nem privilégios de tabela; homologação tem RLS ligado. Não foi demonstrada exploração nem validada a superfície HTTP/Data API. Advisor: 25 tabelas RLS sem policies (INFO), aviso de senhas comprometidas desativado (WARN). | Consultas de catálogo `pg_class`, `pg_namespace`, `pg_roles`, `has_schema_privilege`, `has_table_privilege`, `pg_policies` e Supabase Security Advisors, executadas sem mutações em 09/10/2026. | Conferir Data API, negação HTTP e fluxo da aplicação antes de propor mudança de RLS |

| 09/10/2026 | A01 — tentativa de verificação HTTP | Railway confirmou domínio produtivo `fiscalizagilmarnascimento-production.up.railway.app`; Supabase confirmou URL e existência de chave pública (valor não registrado). Requisições GET sem autenticação para `/health`, `/api/admin/equipe` e REST `private.setores` **não chegaram aos serviços** por erro de resolução DNS no executor. Sem status HTTP: teste INCONCLUSIVO, não equivale a falha do sistema. `pg_roles.rolconfig` do `authenticator` não mostra override `pgrst.db_schemas`; publicação real de schemas ainda não confirmada. | Railway list-domains; Supabase get-project-url/get-publishable-keys sem revelar chaves; consultas somente leitura; tentativa GET local falhou no DNS | Testar HTTP a partir de ambiente com DNS/rede, confirmar exposições do painel, e documentar status antes de fechar A01 |

| 09/10/2026 | A01/A02 — conferência observacional Railway | Produção continua SUCCESS no commit `e51ef50`. Em 72h: 20 requisições consideradas nas métricas do serviço, nenhuma 5xx e uma 4xx. Logs consultados: 0 ocorrências do erro SQLite e 3 respostas HTTP 401 de rotas variadas; não constituem teste direcionado de `/api/admin/equipe`. Contagem de `/health` e `/ready` nos filtros consultados: zero, portanto sua resposta atual não foi validada. Tentativas GET externas no executor falharam por DNS. **A01 e A02 permanecem abertas.** | Railway `list_deployments`, `http_error_rate`, `http_requests` e `get_logs` em 09/10/2026 | Validar HTTP diretamente em ambiente com DNS; só fechar após verificar resultados específicos e Data API |

| 09/10/2026 | A01/A02 — GET real em produção | `/health` = 200; `/ready` = 200; `/api/admin/equipe`, `/api/admin/demandas`, `/api/admin/audit` = 401 sem cookies/autenticação. Workflow separado com somente GET e sem resposta corporal; **não comprova acesso entre assessores nem schema `private` Supabase**. Passo temporário do CI removido após confirmação. | [GitHub Actions #37946872319](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37946872319) | Verificar Data API e escopo RBAC autenticado com identidades sintéticas na homologação |
| 09/10/2026 | A00 — novo bloqueador do CI | Dois jobs falham em `npm run audit:high`: `proxy-addr` 2.0.7 (CRITICAL) e `source-map-js` 1.2.1 (HIGH). Dependências transitivas confirmadas no `package-lock.json`. Atualização não aplicada. | [CI #37946385763](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37946385763); [issue #94](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/issues/94) | Atualização mínima e validação completa em PR separado |

> Adicionar uma linha a cada etapa comprovada. Se uma tentativa falhar, registrar como **falhou/pendente**, sem marcar o checkbox.

| 09/10/2026 | A00 — correção preparada em PR isolado | [PR #95](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/95) troca `proxy-addr` 2.0.7→2.0.8 e `source-map-js` 1.2.1→1.2.2 apenas no lockfile (6+ / 6−). `npm ci`, build, TypeScript e os dois gates `npm audit` aprovados; Visual QA SUCCESS. **CI segundo job ainda verificando Deep QA na última consulta.** Nenhum merge/deploy. | [CI #37948199475](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199475); [Visual QA #37948199334](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199334); [issue #94](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/issues/94) | Concluir CI integral, homologação e decisão de liberação com rollback |

## Plano de validação e rollback do PR #95 (09/10/2026)

### Situação confirmada
- [x] PR #95 permanece aberto, sem merge; head `8bcb724e2be92d6199f080d4c14c1ace72e7014a`, base `main` em `e51ef50d86b80b03c786ae3193a8a802ff9e5cfb`.
- [x] Job P0 do [CI #37948199475](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199475): **success**.
- [x] `npm run audit:high` aprovado nos dois jobs; [Visual QA #37948199334](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199334): **success**.
- [x] Conclusão global do CI/Deep QA: dois jobs `success` em 09/10/2026, incluindo `Deep QA with real public data` e auditoria de vulnerabilidades.
- [x] Conferir Railway: homologação e produção usam serviços, ambientes e URLs separados; produção segue commit `e51ef50` e homologação segue `88c2cf42`, da branch `fix/citizen-login-contract-diagnostics-20260924`.
- [x] Consultar inventário de projetos Supabase distintos em 09/10/2026: homologação com 2 cidadãos e 0 demandas; produção com 21 cidadãos e 71 demandas. Isso **não comprova** que o Railway utiliza a instância correta.
- [ ] **Confirmar por prova segura** que `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_EVIDENCE_BUCKET` da homologação se referem **exclusivamente** a recursos de homologação; os conectores atuais revelam apenas nomes de variáveis, nunca valores. **Não mudar a source da homologação nem executar testes de escrita enquanto não comprovado**.

### Critérios de homologação
- [ ] Fixar o serviço de homologação **somente** no commit testado do PR #95, mantendo histórico da source anterior e anotando o novo deployment ID.
- [ ] Com dados sintéticos e sem gravação na produção, conferir `/health`, `/ready`, login e sessão, logout, cadastro em IP compartilhado, 401 nas rotas protegidas e controles de setor.
- [ ] Conferir logs sem segredos, resposta HTTP 5xx, `npm audit`, integridade de dados e eventuais falhas de inicialização.
- [ ] Não fazer merge se CI/Deep QA falhar ou se não for possível confirmar isolamento e rollback.

### Rollback documentado (não executado)
- **Produção antes do PR:** Railway serviço `fiscaliza_gilmar_nascimento`, environment `production`, deployment `ac88cb02-d036-4305-929d-c95592fe046f`, commit `e51ef50`, status `SUCCESS`, `canRollback=true` na consulta de 09/10/2026.
- **Homologação antes da mudança:** serviço `fiscalize-homologacao`, environment `homologacao`, deployment `a66986a6-ff30-42ec-b0af-05aae60e0a9e`, commit `88c2cf42`, status `SUCCESS`, `canRollback=true`.
- Se a validação falhar, **interromper a promoção**, restaurar a source/commit anterior **do mesmo ambiente**, usando redeploy do deployment de referência se ainda disponível e compatível, e conferir health/ready, sessões, logs e dependências.
- Se um deployment de produção posterior for revertido, também coordenar com GitHub para que a branch `main` não publique novamente automaticamente a versão defeituosa. **Não restaurar banco em produção sem diagnóstico, backup íntegro e autorização específica.**
- O rollback de código não desfaz alterações de schema, dados ou Storage (não previstos neste PR). Revalidar os identificadores e elegibilidade de rollback imediatamente antes de qualquer ação.
- **Estado de liberação:** NÃO AUTORIZADO; sem deploy, merge ou mutação de banco nesta etapa.

| 09/10/2026 | A00 — conclusão do CI e inventário de bancos | PR #95: CI com dois jobs `success`, Deep QA `success`, Visual QA `success`. Supabase apresenta projetos separados, homologação 2 cidadãos/0 demandas e produção 21 cidadãos/71 demandas. **Vinculação do Railway às instâncias Supabase ainda não comprovada** porque valores das variáveis são redigidos. Não houve deploy nem merge. | [CI #37948199475](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199475); [Visual QA #37948199334](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37948199334); inventário Supabase 09/10/2026 | Provar isolamento de conexão de banco/Storage e homologar PR #95 |

## Verificação adicional de homologação — 09/10/2026

- [x] Consultar estado final do PR #95: CI e Full QA `success`, PR ainda aberto e não mesclado.
- [x] Inspecionar a configuração ativa do Railway homologação: segue `fix/citizen-login-contract-diagnostics-20260924`, deployment `a66986a6-ff30-42ec-b0af-05aae60e0a9e` com status `SUCCESS`.
- [x] Detectar nos logs disponíveis erros de scheduler: `SqliteError: no such table: intelligence_refresh_runs` em `intelligence/refresh`. Não é possível atribuir esse erro ao PR #95, que ainda não está publicado no ambiente. Verificar janela temporal/recorrência e funcionamento após futura atualização.
- [ ] Confirmar destino **efetivo** do `DATABASE_URL` e do `SUPABASE_URL`/bucket da homologação por verificação segura sem divulgar credenciais; nomes de variáveis e projetos Supabase separados não provam esse vínculo.
- [ ] Implantar PR #95 na homologação **apenas** depois de comprovar isolamento, realizar smoke tests sintéticos e conferir logs.
- [ ] Não realizar merge ou deploy de produção até aprovação específica dos gates de homologação e rollback.

**Decisão:** NO-GO temporário para trocar a source da homologação enquanto a ligação a banco e Storage isolados não estiver demonstrada.

## Verificação de redes Railway — 09/10/2026

- [x] Coletar somente metadados de DNS/fluxo de rede no Railway, sem valores de variáveis. Produção resolveu `jnlfmiwczpglojqytrbw.supabase.co` e `aws-0-us-west-2.pooler.supabase.com`, compatível com Supabase de produção. Homologação apresentou egress TCP na porta `6543`, compatível com pooler PostgreSQL, porém **sem amostras DNS disponíveis nesta consulta**.
- [x] Comprovar via `railway run` que **a configuração** da homologação indica projeto Supabase `zqxouixpokuprqqscnwf` tanto em `DATABASE_URL` quanto em `SUPABASE_URL` (9 checks `OK`, operador, 09/10/2026). Host/tenant textual não prova conexão viva.
- [ ] **Pendente crítico:** comprovar acesso real ao bucket de homologação, com credencial válida e configuração privada. Nenhum teste de escrita permitido.
- [ ] Confirmar o projeto PostgreSQL em execução por prova controlada, somente leitura, idealmente impressão digital HMAC/identificador do tenant da conexão, **sem registrar DSN, senha, chave de serviço, credenciais nem dados de usuários**. Comparar com IDs esperados `zqxouixpokuprqqscnwf` (homologação) e `jnlfmiwczpglojqytrbw` (produção).
- [x] Validar identificador de `SUPABASE_URL` na homologação via `railway run`: `SUPABASE_API_PROJETO=OK` (09/10/2026).
- [ ] Confirmar acesso real a `SUPABASE_EVIDENCE_BUCKET` com consulta **somente metadados**, sem listar arquivos; `STORAGE_BUCKET_CONFIGURADO=OK` não comprova que o bucket exista ou seja privado. Não executar escrita nem trocar source antes da verificação.

**Interpretação:** produções DNS observados e conexão TCP da homologação não constituem comprovação do isolamento completo. **NO-GO** para trocar a branch e rodar testes de escrita.

## Instrumentação de pré-validação segura — 09/10/2026

- [x] Identificar que o conector Railway por OAuth permite **nomes**, mas não valores de variáveis, impedindo comprovação direta de tenant no contexto do ChatGPT.
- [x] Confirmar que DNS de produção mostra projeto de produção e que a porta TCP 6543 em homologação **não identifica o tenant** de um pooler compartilhado.
- [x] Preparar verificador isolado e sem segredos em [PR #96](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/96), `scripts/verify-staging-destinations.mjs`; sem operações de rede, banco ou Storage; resultados somente `OK`, `DIVERGENTE`, `INCONCLUSIVO`.
- [ ] Revisar CI do PR #96 e executar o verificador **dentro do ambiente de homologação**, com variáveis do Railway; valores de credenciais nunca devem ser compartilhados.
- [ ] Validar separadamente titularidade/acesso ao bucket de testes; configuração presente não comprova destino do Storage.
- [ ] Continuar NO-GO para trocar a source da homologação até completar esses controles. A criação do PR #96 **não implantou** o diagnóstico nem executou o verificador.

## PR #96 — validação técnica de cenários sintéticos (09/10/2026)

- [x] Revisar e reforçar o verificador: validar hostname oficial do Postgres, IDs do projeto/ambiente/serviço Railway, bloquear host desconhecido e conflito entre usuário/host; nunca retornar credenciais.
- [x] Criar 10 testes sintéticos sem banco nem rede: [workflow #37951925339](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37951925339) finalizado `success` (**10 pass, 0 fail**). Commit do workflow `850bab2`, em [PR #96](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/96).
- [ ] CI geral do PR #96 ainda não foi confirmado com conclusão `success`; instâncias anteriores falharam em `npm audit` por dependências antigas da `main` (tratadas separadamente no PR #95). Não associar essas falhas ao teste sintético.
- [x] Operador executou `railway run` com variáveis **reais da homologação** em PowerShell: 9 verificações `OK`, `PREFLIGHT_CONFIG=OK_PARCIAL`, `IDENTIDADE_REAL_STORAGE=NAO_COMPROVADA`, `LIBERACAO_IMPLANTACAO=NAO_AUTORIZADA` (09/10/2026). Validação textual de configuração apenas; não constitui teste de conexão real nem de acesso ao bucket.
- [ ] Verificar bucket Storage por ferramenta/procedimento autorizado, sem divulgar segredo nem listar arquivos privados.
- [ ] Somente após prova do isolamento, reavaliar implantação de PR #95 em homologação; nenhuma source alterada.

**Procedimento recomendado para operador autorizado:** em checkout exato do PR #96, com Railway CLI autenticada e serviço/ambiente explicitamente selecionados, executar `railway run --project acd59c0a-4723-4162-9bfc-33bab1f096b0 --environment 32940765-7ef3-41c1-a017-48ad13120d65 --service 98959349-60d9-4363-b7c3-e20e04e93a71 node scripts/verify-staging-destinations.mjs`. Verificar sintaxe das flags com `railway run --help` no CLI instalado. Relatar somente as linhas de status, nunca as variáveis. `railway run` executa localmente com variáveis do Railway, não dentro do container; sua prova é parcial e requer a verificação do destino real do Storage e da conexão no runtime.

## Pré-validação real de configurações — retorno do operador (09/10/2026)

- [x] Operador autenticado no Railway executou o **verificador do PR #96** localmente com as variáveis do serviço de homologação. Saída exata de status: `RAILWAY_PROJETO=OK`, `RAILWAY_AMBIENTE=OK`, `RAILWAY_AMBIENTE_ID=OK`, `RAILWAY_SERVICO_ID=OK`, `SUPABASE_API_PROJETO=OK`, `POSTGRES_PROJETO=OK`, `BANCO_API_CONSISTENTES=OK`, `STORAGE_BUCKET_CONFIGURADO=OK`, `STORAGE_CHAVE_CONFIGURADA=OK`.
- [x] Resultado consolidado: `PREFLIGHT_CONFIG=OK_PARCIAL`. Os identificadores configurados são coerentes com a homologação, não há evidência de apontamento textual à produção.
- [ ] Confirmar existência, acesso autorizado e caráter privado do bucket por **leitura pontual dos metadados** no endpoint oficial da instância de homologação, usando a credencial do ambiente, sem enumerar objetos, expor variáveis ou modificar dados; a Supabase documenta `getBucket()` para essa operação.
- [ ] Confirmar quando necessário o sucesso da conexão PostgreSQL em execução por uma verificação isolada, apenas leitura, depois da comprovação de identidade, sem dados pessoais.
- [ ] A saída do próprio script mantém `IDENTIDADE_REAL_STORAGE=NAO_COMPROVADA` e `LIBERACAO_IMPLANTACAO=NAO_AUTORIZADA`; PR #95 ainda **não** deve ser publicado em homologação/produção.

## Storage validado e deploy de homologação preparado — 09/10/2026

- [x] Verificação real por operador autenticado: `STORAGE_ACESSO=OK`, `STORAGE_BUCKET_IDENTIDADE=OK`, `STORAGE_BUCKET_PRIVADO=OK`, `STORAGE_PREFLIGHT=OK`; somente leitura pontual de metadados, sem listagem de objetos ou escrita.
- [x] Verificação textual anterior: nove verificações Railway/URL Postgres/Supabase `OK`, indicando destino de homologação (`PREFLIGHT_CONFIG=OK_PARCIAL`). Não comprova query ao banco em execução.
- [x] Inspecionar e preparar **apenas em staged** a origem do serviço Railway de homologação: [PR #95](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/95), branch `security/p0-deps-proxy-addr-source-map-20261009`, commit fixo `8bcb724e2be92d6199f080d4c14c1ace72e7014a`.
- [x] Revisar patch Railway `b6ab2b96-4f4c-4dbd-a2cb-f5b8370bc987`: 4 entradas de source para **um único serviço de homologação**, sem variáveis compartilhadas, sem recursos removidos, `destructive=false`, `status=STAGED`. Produção não participa.
- [x] Preservar referência da versão live anterior de homologação: deployment `a66986a6-ff30-42ec-b0af-05aae60e0a9e`, commit `88c2cf42`, `SUCCESS`. O staged **não faz deploy**, e permanece pendente até liberação explícita.
- [ ] **Aplicar staged em homologação somente após aprovação explícita do deploy**, validar nova versão, saúde, logs, rotas protegidas, dados sintéticos e rollback.
- [ ] Não executar merge para `main` nem deploy de produção nesta etapa.

## Deploy PR #95 autorizado — 09/10/2026

- [x] Usuário autorizou explicitamente aplicação **somente em homologação**.
- [x] Revalidar patch Railway `b6ab2b96-4f4c-4dbd-a2cb-f5b8370bc987`: um serviço de homologação, commit fixo `8bcb724e2be92d6199f080d4c14c1ace72e7014a`, sem alterações de variáveis, outros recursos ou exclusões; patch não destrutivo.
- [x] Executar `accept-deploy` exclusivamente para ambiente `32940765-7ef3-41c1-a017-48ad13120d65`; Railway confirmou `committed=true`, `deploymentStatus=triggered`.
- [x] Confirmar novo deployment `b8121296-fff0-4e9a-9099-b7c5dbd173d7` no serviço homologação, commit `8bcb724`; status inicial `BUILDING`.
- [x] Confirmar novo deployment `b8121296-fff0-4e9a-9099-b7c5dbd173d7` em `SUCCESS` e 1/1 réplica online; [GET smoke #37956034570](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37956034570): `/health` e `/ready` HTTP 200; três rotas administrativas HTTP 401. Logs iniciais sem erros, porém janela curta — não garante ausência futura do erro legado `intelligence_refresh_runs`.
- [x] Conferir métricas imediatas de homologação: 5 requisições, 2 respostas 2xx, 3 respostas 4xx esperadas, 0 respostas 5xx; sem falhas reportadas no startup (09/10/2026).
- [ ] Avaliar regressões funcionais autenticadas (contas sintéticas, sessão, RBAC por setor) e janela maior para scheduler; CI geral do PR #96 ainda depende do PR #95 na `main`. **Não promover produção sem esses gates.**
- [ ] Caso o novo deployment falhe, inspecionar logs e decidir rollback com referência `a66986a6-ff30-42ec-b0af-05aae60e0a9e`; não executar rollback sem constatar falha.
- [ ] Não fazer merge PR #95 nem deploy em produção antes de concluir homologação.

## Autenticação, sessão, setor e estabilidade — 09/10/2026

- [x] Confirmar CI do commit `8bcb724e2be92d6199f080d4c14c1ace72e7014a`: os dois jobs `success`, inclusive `Citizen session revocation security`, `Sector scope access control`, `Team management access control`, `Account recovery security contract` e `Go-live readiness smoke tests`. Testes de contrato/runtime **sintéticos**, não testes com sessão real no Railway.
- [x] Executar GET-only em homologação: sessão anônima HTTP 401; sessão com cookie inválido HTTP 401; equipe, demandas e auditoria administrativas com cookie inválido HTTP 403. Todos **negam acesso**: [GitHub Actions #37957043741](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37957043741) `success`; sem logins, contas, senhas ou escrita.
- [x] Revisar logs de startup e solicitações do deployment `b8121296-fff0-4e9a-9099-b7c5dbd173d7`: 1/1 réplica online, sem notificações ativas, 2 respostas 200 e 3 respostas 401 no primeiro smoke, ausência de 5xx na amostra; logs consultados sem erros de inicialização.
- [ ] Comprovar autenticação/logout com **contas sintéticas criadas e aprovadas especificamente para homologação**, RBAC autenticado cruzado de dois setores, alterações de status e auditoria em banco de testes: **não executado** nesta etapa; nenhuma conta ou demanda real foi manipulada.
- [ ] Estender janela observada para verificar o agendador e o erro legado `intelligence_refresh_runs`; os logs imediatos não comprovam comportamento de longa duração.
- [ ] Não interpretar aprovação de 401/403 como comprovação de isolamento autenticado completo; produção e merge da `main` permanecem fora de escopo.

## Preparação de contas sintéticas por setor — 09/10/2026

- [x] Conferir esquema existente de criação de membros, autenticação com `bcrypt`, política de acesso por setor, filtragem de demandas e migração `20260922190000_setores_papeis_equipe.sql`.
- [x] Consultar **metadados de contagem, sem acessar dados pessoais** em dois projetos Supabase: homologação `private.admins=0`, `private.setores=0`, `private.setor_categorias=0`, `public.demandas=0`; produção `private.admins=11`, `private.setores=9`, `public.demandas=71`.
- [ ] Preparar estrutura mínima de dois setores de testes no **banco de homologação apenas**, respeitando as migrações versionadas. Não copiar setores, assessores, cidadãos ou demandas da produção.
- [ ] Criar duas contas sintéticas rastreáveis, cada uma vinculada a categoria distinta, sem compartilhar senhas em chat, logs ou CI; usar hash bcrypt, expiração/limpeza e contas sem privilégios globais.
- [ ] Criar no máximo duas demandas fictícias separadas para testar filtros e negação de acesso cruzado; revisar efeitos de auditoria, gatilhos e política de exclusão antes de qualquer operação.
- [ ] Exercitar sessões autenticadas e comprovar que assessor A não lê nem altera registros de B e vice-versa, incluindo gestão de equipe bloqueada, expiração/remoção dos tokens após desativação; coletar somente resultados HTTP e contagens.
- [ ] Executar limpeza segura de toda a massa de QA e verificar contagens de registros de testes = 0, preservando dados preexistentes.
- [ ] Permanecer **NO-GO para produção** até testes integrados autenticados, observação do scheduler e revisão do rollback.

**Decisão:** diagnóstico concluído, preparação de fixtures pendente. Nenhuma conta, setor, demanda ou dado real foi alterado nesta etapa.

## QA de setores — diagnóstico de integridade anterior à gravação (09/10/2026)

- [x] Histórico Supabase de homologação inclui migração de setores `20260924175047` (originada de `20260922190000_setores_papeis_equipe.sql`), mas `private.setores`, `private.setor_categorias` e `private.admins` ainda reportam **0 linhas** no inventário.
- [x] Logs de inicialização da aplicação homologação `b8121296` reportam “Administrador privado Postgres atualizado com sucesso” / “Bootstrap admin: conta privada configurada e validada”. **Divergência de estado a investigar**: não provar que é o mesmo banco só pela URL de configuração.
- [x] Abrir [PR #97](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/pull/97) com diagnóstico **somente SELECT** e validação estrita dos IDs Railway/Supabase. Script `scripts/qa-staging-db-readonly.mjs` obtém apenas contagens agregadas sem identificadores, nomes, registros ou credenciais.
- [ ] Executar com `railway run` na homologação autenticada, comparar contagens observadas com inventário do projeto Supabase e esclarecer divergência **antes de qualquer INSERT**.
- [ ] Somente após isso, preparar fixtures temporárias de dois setores, dois usuários e duas demandas e limpeza transacional/explicitamente limitada aos IDs de teste, com trilha de auditoria sem PII.
- [ ] Testar autenticação real, isolamento por setor e limpeza; produção NÃO pode receber fixture.

**Decisão:** embora exista autorização para prosseguir, criação de contas sintéticas foi adiada por risco de a instância efetiva divergir do inventário de homologação. Nenhum INSERT executado.

## Encerramento diário (preencher ao final)

- **Atividades concluídas e comprovadas:** GET anônimo das rotas administrativas (401), `/health` (200), `/ready` (200), diagnóstico de privilégios e identificação das dependências vulneráveis; atividades A00/A01/A02 continuam em andamento.
- **Pendências e bloqueadores:** A00 (segurança de dependências), A01 (Data API/RBAC), A02 (readiness detalhado/rollback), A03–A08.
- **Incidentes ou impactos em produção:** nenhum causado por este documento.
- **Primeira atividade da próxima sessão:** A00 — preparar correção mínima de dependências em PR isolado; em paralelo, concluir validação Data API/RBAC de A01.
- **Liberação para 300 cidadãos / 50 assessores:** NÃO AUTORIZADA; depende de evidências de segurança, carga, backup e validação operacional.
