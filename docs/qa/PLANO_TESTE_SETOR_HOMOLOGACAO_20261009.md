# Plano de teste autenticado entre setores — homologação

**Estado:** PREPARADO, sem autorização técnica para gravação automática; nenhuma fixture criada.

## Inventário comprovado (09/10/2026)
- Railway CLI e consulta SQL direta Supabase homologação: 3 administradores, 9 setores, 9 categorias e 2 demandas.
- Todos os 9 setores ativos; 1 categoria por setor. Contagem bruta de vínculo de admins: SAUDE=1, EDUCACAO=1; demais=0. Um terceiro admin não possui vínculo com setor.
- 2 demandas preexistentes: categoria SAUDE=1, INFRAESTRUTURA_URBANA=1; status RECEBIDA. Não foram identificados marcadores de QA nos campos pesquisados. **Preservar ambas**.
- Query de agrupamento de administradores bloqueada pela política da ferramenta. Não solicitar nem listar nome, e-mail ou senha de contas existentes.

## Isolamento e escopo
- Somente projeto Supabase `zqxouixpokuprqqscnwf` e Railway ambiente `32940765-7ef3-41c1-a017-48ad13120d65`.
- Reutilizar setores SAUDE e INFRAESTRUTURA_URBANA, sem criar/alterar setor ou taxonomia.
- Criar duas contas `ATENDENTE` exclusivamente de QA, uma em cada setor, com UUIDs e e-mails `@example.invalid` exclusivos; hash bcrypt custo 12. Senhas efêmeras geradas no executor, nunca enviadas ao chat ou logs.
- Criar duas demandas exclusivas QA com UUIDs/protocolos prefixados por lote único, categorias SAUDE e INFRAESTRUTURA_URBANA, valores fictícios sem telefone, nome ou endereço real. Nunca reutilizar demandas preexistentes.
- Antes de cada INSERT, transação deve confirmar projeto/tenant, os 9 setores ativos, categorias exatas, e inexistência de qualquer UUID ou protocolo do lote; sair com erro caso contrário. Fazer snapshot das contagens preexistentes e identificar gatilhos de auditoria e demais FKs.
- Proibir chamadas POST/PATCH de QA a dados preexistentes, mesmo que apareçam na listagem. Asserções usam somente identificadores das fixtures.
- Testar login por conta QA, cookies HttpOnly/Secure, `GET /api/auth/session`, listagem de demandas limitada ao setor, acesso cruzado por ID a evidências, gestão de equipe negada e revogação de sessão após desativação.
- Apenas depois de validar consultas, preparar limpeza ordenada por UUIDs/protocolos do lote, verificando FKs e logs de auditoria; não usar `TRUNCATE`, `DELETE` sem filtro de ID nem `CASCADE` global. Idealmente manter trilha de auditoria agregada e excluir somente se não comprometer obrigações de compliance.
- Tratar falhas de teste como NO-GO; executar rollback apenas da massa de QA rastreada. Guardar resultados sem PII.

## Critérios para execução
- Revisão de restrições, triggers e dependências de limpeza ainda pendente.
- Autorização geral do usuário para prosseguir já concedida; nenhuma escrita deve ocorrer se o identificador do destino falhar, ou se limpeza reversível não estiver comprovada.
- PR #95 já implantado apenas em homologação; produção e `main` permanecem inalteradas.

## Auditoria de dependências, gatilhos e papéis — 09/10/2026

- [x] Consultas SQL de metadados, **somente leitura**, executadas diretamente no projeto de homologação `zqxouixpokuprqqscnwf`.
- [x] Inventário agregado de perfis: 3 administradores internos; 1 ADMIN/SUPER_ADMIN, 2 ATENDENTE, 0 COORDENADOR. Não consultar credenciais nem perfis nominais.
- [x] SAUDE e INFRAESTRUTURA_URBANA possuem setor ativo com uma categoria cada. SAUDE já tem um atendente vinculado; INFRAESTRUTURA_URBANA não tem atendentes vinculados.
- [x] Sem triggers **personalizados** nas tabelas-alvo consultadas. Isso não elimina gatilhos internos de FK, nem obrigações de auditoria.
- [x] Referências relevantes: `private.field_registration_tickets.assessor_id -> private.admins.id` sem cascade; `private.admins.setor_id -> private.setores.id`; `public.demanda_evidencias.demanda_id -> public.demandas.id ON DELETE CASCADE`; `public.historico_status_demandas.demanda_id -> public.demandas.id ON DELETE CASCADE`.
- [ ] Antes de inserir contas, definir execução isolada com segredos somente na memória local, identificadores de lote e teardown independente, protegendo tickets, evidências e auditoria. Não apagar demandas existentes nem assumir que correspondem a testes.
- [ ] Criar as duas contas efêmeras e demandas sintéticas com identificadores exclusivos somente após revisar script de provisionamento, limpeza e políticas da API.
- [ ] Testar listagem e acesso cruzado, expiração e remoção segura das fixtures. Nunca reutilizar administradores existentes nem alterar senhas preexistentes.

**Conclusão:** auditoria pré-fixture favorável, porém gravação/limpeza **ainda não executada**. Produção fora de escopo.


## Executor integrado com guardas sintéticas — 09/10/2026

- [x] Criado `scripts/qa-staging-sector-e2e.mjs` com modo padrão read-only, e comando separado `--execute` para QA autenticada. Inclui validação do ambiente Railway e tenant Supabase, senhas efêmeras locais, transação de criação, testes de login e RBAC, e cleanup seletivo com recuperação `--cleanup=<lote>`.
- [x] Criados testes `tests/qa-staging-e2e-guards.test.mjs`, rodados sem variáveis Railway ou conexão de banco: [GitHub Actions #37978850149](https://github.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/actions/runs/37978850149) `success`.
- [x] Confirmada homologação em Railway `SUCCESS`, 1/1 réplica online; produção não foi acionada.
- [ ] Executor ainda não rodou com `--execute`; logo não foram criados/limpos registros de teste nem verificados login e RBAC autenticados reais.
- [ ] A execução local necessita o CLI do Railway autenticado e variáveis de homologação. **Antes da execução, revisar o plano de cleanup em caso de falha, e não compartilhar senhas ou URLs de conexão.**


## Resultado E2E real e limpeza confirmada — 09/10/2026

- [x] Operador autenticado executou `railway run ... node scripts/qa-staging-sector-e2e.mjs --execute` exclusivamente na homologação. Lote sintético `86c29a4b1f2ba5bb`.
- [x] Resultado do executor: `QA_GUARDA=OK`, `QA_BASELINE=OK`, `QA_FIXTURES=CRIADAS`, `QA_LOGIN_SESSOES=OK`, `QA_ISOLAMENTO_LISTAGEM=OK`, `QA_BLOQUEIO_EQUIPE=OK`, `QA_ALTERACAO_CRUZADA=NEGADA`, `QA_ALTERACAO_PROPRIA=OK`, `QA_REVOGACAO=OK`, `QA_LOGOUT=OK`, `QA_TESTES=SUCCESS`, `QA_LIMPEZA=OK`, `QA_PRODUCAO=NAO_ACESSADA`.
- [x] Consulta direta de verificação no Supabase homologação confirmou baseline restaurada: **3 admins, 9 setores, 9 categorias e 2 demandas**. Remanescentes do lote: **0 administradores e 0 demandas**; nenhuma demanda preexistente alterada pelo executor conforme escopo e contagens. Histórico vinculado ao lote em demandas existentes: 0.
- [x] Railway homologação: deployment `b8121296-fff0-4e9a-9099-b7c5dbd173d7` `SUCCESS`, 1/1 réplica online, zero avisos/críticos. Runtime especificamente desse deployment com 0 ocorrências de `intelligence_refresh_runs`/`SQLITE_ERROR` nos 26 registros retornados; logs agregados do serviço contêm erros do deployment anterior e não devem ser confundidos com o novo.
- [x] Produção permanece com deployment anterior `ac88cb02-d036-4305-929d-c95592fe046f` `SUCCESS`; nenhum deploy ou merge de `main` efetuado pela validação.
- [ ] **Pendente de auditoria:** confirmar por lote/UUID a contagem e retenção adequada de eventos em `public.logs_auditoria` e que não contém dados sensíveis; preservá-los conforme LGPD. Zero auditoria por protocolo não é prova de ausência de eventos, pois `entidade_id` de status usa UUID.
- [ ] Antes de promover PR #95 a `main` e produção: checar CI atual, divergências de branches/PRs, plano de rollback e eventuais alterações pendentes no Railway de produção (uma operação pendente foi reportada; investigar separadamente, sem aplicar).


## Parecer de fechamento de homologação e pendências — 09/10/2026

**GO para encerramento dos testes de homologação do PR #95; NO-GO para publicação em produção sem aprovação específica.**

- [x] Execução QA E2E autenticada com dois setores e teardown `SUCCESS`, lote `86c29a4b1f2ba5bb`.
- [x] Supabase homologação reconsultado: 3 administradores, 2 demandas, 0 contas e 0 demandas remanescentes identificadas com o lote.
- [x] Auditoria agregada: 6 registros em `public.logs_auditoria`, 1 evento global `STATUS_ATUALIZADO`, 0 ocorrências do identificador do lote em `metadata` ou `entidade_id`. O evento de status pode estar associado à demanda QA excluída porque `entidade_id` armazena UUID; NÃO excluir auditoria sem avaliação de retenção.
- [x] PR #95 head `8bcb724e2be92d6199f080d4c14c1ace72e7014a`, CI `37948199475` e Visual QA `37948199334` `success`; diff restrito ao lockfile (`proxy-addr` 2.0.7→2.0.8 e `source-map-js` 1.2.1→1.2.2). Homologação roda o mesmo commit.
- [x] PR #97 head `d53748e1f21ea73970a5401326353ce2c7c94ade`, CI `37980430786`, Visual QA `37980430691` e guardas QA `37980430754` `success`. PR #97 permanece draft, sem merge.
- [x] PR #96 com checks isolados `success`, mas CI geral `failure` no head `ec664c58219afd851f69a743e38380a1fe2746d6`; precisa integrar lockfile de #95 ou descartar se não necessário.
- [x] Produção segue no commit `e51ef50d86b80b03c786ae3193a8a802ff9e5cfb` com deployment `ac88cb02-d036-4305-929d-c95592fe046f`, `SUCCESS`. Nenhum merge/deploy realizado.
- [ ] Verificar discrepância: `environment_status` da produção informou 1 `EnvironmentPatch` staged, enquanto `get_staged_changes` informou `null`; consultar novamente antes de qualquer alteração e jamais aplicar patch de conteúdo não verificado.
- [ ] Registrar decisão de política de retenção do evento de auditoria associado a uma demanda já removida (registro pseudonimizado, integridade referencial e exigências LGPD), sem apagar rastros.
- [ ] Para lançar a correção em produção: revisão de diff, aprovar merge PR #95, revalidar CI da main, confirmar staged pendente, backup e plano de rollback, então solicitar autorização específica de deploy e realizar smoke pós-deploy.
