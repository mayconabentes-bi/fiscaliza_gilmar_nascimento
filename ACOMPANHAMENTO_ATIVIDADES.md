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

### A01 — Auditar segurança do Supabase
**Estado:** PENDENTE | **Prioridade:** P0

- [x] Consultar privilégios SQL e grants efetivos dos papéis `anon`/`authenticated` para `private.setores` e `private.setor_categorias` (09/10/2026: sem USAGE no schema e sem SELECT/INSERT/UPDATE/DELETE nas duas tabelas). **Acesso funcional pela API ainda pendente.**
- [ ] Confirmar exposição efetiva do schema `private` pela Data API e testar negação HTTP com identidade não autorizada, sem enviar segredos a logs.
- [x] Comparar estado RLS produção/homologação (09/10/2026: desligado nas duas tabelas em produção; ligado em homologação; sem políticas detectadas na consulta de produção).
- [ ] Revisar a necessidade e desenho de RLS nessas tabelas; **não habilitar RLS nem criar policies sem ensaio e plano de retorno**.
- [ ] Testar acesso negado com identidades não autorizadas e isolamento entre setores, sem usar dados pessoais reais.
- [ ] Registrar achados, decisões e evidências, sem imprimir segredos.

**Critério de conclusão:** acessos efetivos demonstrados, políticas/grants revisados, nenhum acesso indevido e evidência de testes em homologação.  
**Aprendizado:** RLS filtra linhas; `GRANT` controla privilégios SQL; a exposição de schemas pela Data API é uma terceira camada.  
**Observação:** o inventário Supabase apresentou alerta crítico de RLS desabilitado nessas duas tabelas; exposição efetiva precisa ser comprovada.

### A02 — Verificar saúde da produção Railway
**Estado:** PENDENTE | **Prioridade:** P0

- [ ] Testar resposta de `/health` e `/ready`, incluindo dependências e possível estado degradado.
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
| 09/10/2026 | A01 — levantamento SQL somente leitura | Produção: `private.setores` e `private.setor_categorias` sem RLS, mas `anon`, `authenticated`, `authenticator` e `service_role` não têm USAGE no schema nem privilégios de tabela; homologação tem RLS ligado. Não foi demonstrada exploração nem validada a superfície HTTP/Data API. Advisor: 25 tabelas RLS sem policies (INFO), aviso de senhas comprometidas desativado (WARN). | Consultas de catálogo `pg_class`, `pg_namespace`, `pg_roles`, `has_schema_privilege`, `has_table_privilege`, `pg_policies` e Supabase Security Advisors, executadas sem mutações em 09/10/2026. | Conferir Data API, negação HTTP e fluxo da aplicação antes de propor mudança de RLS |

> Adicionar uma linha a cada etapa comprovada. Se uma tentativa falhar, registrar como **falhou/pendente**, sem marcar o checkbox.

## Encerramento diário (preencher ao final)

- **Atividades concluídas e comprovadas:** ainda não preenchido.
- **Pendências e bloqueadores:** A01–A08.
- **Incidentes ou impactos em produção:** nenhum causado por este documento.
- **Primeira atividade da próxima sessão:** A01 — auditar permissões e RLS do Supabase.
- **Liberação para 300 cidadãos / 50 assessores:** NÃO AUTORIZADA; depende de evidências de segurança, carga, backup e validação operacional.
