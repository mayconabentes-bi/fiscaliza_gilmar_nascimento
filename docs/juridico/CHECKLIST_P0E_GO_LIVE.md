# Checklist P0-E — go-live da política etária 16+

Versão: 2026-09-P0E

Este checklist controla especificamente a ativação da política etária 16+ e complementa o checklist jurídico geral do FISCALIZE.

## Implementação na branch

- [x] regra de participação autônoma a partir de 16 anos aprovada;
- [x] faixas `UNDER_16`, `AGE_16_17` e `AGE_18_PLUS` definidas;
- [x] módulo central `src/server/agePolicy.ts` implementado;
- [x] backend de cadastro rejeita `UNDER_16`;
- [x] backend de demandas rejeita `UNDER_16`;
- [x] `AGE_16_17` ativa proteção/revisão reforçada;
- [x] `AGE_18_PLUS` segue fluxo normal;
- [x] cadastro público inclui declaração de faixa etária;
- [x] formulário de demanda inclui declaração de faixa etária;
- [x] frontend bloqueia envio autônomo para `<16`, sem substituir a validação backend;
- [x] Política de Privacidade atualizada para regra 16+;
- [x] Termos de Uso atualizados para versão `2026-09-P0E`;
- [x] aviso de privacidade da branch alinhado a `2026-09-v2`;
- [x] migration `20260915160000_p0e_age_protection.sql` revisada quanto a minimização, legado e restrição de valores;
- [x] migration não cria data de nascimento, RG, CPF, documento ou biometria;
- [x] registros legados podem permanecer sem faixa etária até declaração do titular;
- [x] consulta pública por protocolo seleciona apenas protocolo, município, categoria, status e timestamps;
- [x] analytics de funil permanece limitado a evento, origem (`src`) e ação (`acao`), sem dimensão etária;
- [x] teste automatizado de fronteira de dados P0-E incluído na CI.

## Testes automatizados obrigatórios

- [x] CI final verde no head da PR — run #308;
- [x] `test:legal-p0e` aprovado;
- [x] `test:p0e-tech` aprovado;
- [x] `test:p0e-age-flow` aprovado para `<16`, `16–17` e `18+`;
- [x] `test:p0e-boundary` aprovado;
- [x] P0-D, mobile, dispositivos, performance, go-live e acesso privado aprovados após as alterações P0-E;
- [x] auditoria high/critical aprovada.

## Ativação controlada de produção

- [ ] `LGPD_CONSENT_VERSION` em Production atualizado para `2026-09-v2`;
- [ ] migration P0-E aplicada no projeto Supabase correto e histórico de migrations confirmado;
- [ ] deploy da `main` concluído após merge autorizado;
- [ ] `/ready` retorna `privacyNoticeVersion: 2026-09-v2`;
- [ ] `/api/public-config` retorna `privacyNoticeVersion: 2026-09-v2`;
- [ ] smoke `<16`: cadastro e demanda autônomos bloqueados;
- [ ] smoke `16–17`: fluxo permitido e persistência com proteção reforçada confirmada sem exposição pública;
- [ ] smoke `18+`: cadastro/demanda seguem fluxo normal;
- [ ] consulta pública do protocolo não expõe faixa etária, contato, nome nem flags internas;
- [ ] eventos de analytics não recebem nem armazenam faixa etária;
- [ ] Política de Privacidade e Termos renderizam corretamente no ambiente oficial;
- [ ] rotas administrativas continuam protegidas.

## Controles operacionais gerais que permanecem fora da P0-E

Estes itens não devem ser confundidos com a conclusão técnica da política etária e continuam sujeitos ao checklist jurídico geral:

- rotina recorrente de backup efetivamente ativa;
- segunda cópia do backup fora da estação de trabalho;
- primeiro restore test isolado;
- backup de objetos do Storage antes da entrada de evidências reais;
- revisão de retenção de logs do provedor e papéis de fornecedores.

## Critério para sair de draft

A PR P0-E pode sair de draft quando todos os testes automatizados obrigatórios estiverem verdes e não houver bloqueador jurídico/funcional conhecido. Esse critério foi atendido após a CI #308.

## Critério para merge

O merge requer, cumulativamente: CI verde, checklist técnico P0-E sem bloqueadores, migration revisada, plano de aplicação em produção definido e autorização explícita para o go-live. A aplicação em produção continua condicionada ao projeto Supabase correto e à configuração `LGPD_CONSENT_VERSION=2026-09-v2`.
