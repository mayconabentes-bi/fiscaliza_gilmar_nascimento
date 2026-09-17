# Checklist de go-live jurídico — FISCALIZE

Versão: 2026-09-P0

Este checklist separa o que já foi tecnicamente validado do que depende de confirmação operacional no ambiente real de produção.

## Validado tecnicamente na branch `juridico-p0`

- [x] TypeScript/lint
- [x] build de produção
- [x] teste de contrato jurídico P0
- [x] teste de fronteira cívico-eleitoral P0-C
- [x] mobile UI
- [x] matriz de dispositivos
- [x] orçamento de performance mobile
- [x] smoke de go-live
- [x] fluxo de conversão/intake público
- [x] contrato de acesso privado/intelligence
- [x] auditoria de dependências em nível high/critical
- [x] retenção operacional implementada
- [x] moderação de evidências implementada
- [x] ausência de publicação automática de imagem original
- [x] agregação territorial com grupo mínimo
- [x] projeto Supabase de produção identificado
- [x] migration P0-D aplicada em produção
- [x] RLS e revogações de acesso direto validadas
- [x] schema `private` isolado de `anon` e `authenticated`
- [x] bucket de evidências validado como privado
- [x] ausência de policies públicas em `storage.objects`
- [x] administradores de produção validados (`ADMIN` e `SUPER_ADMIN` ativos)
- [x] backup lógico externo do PostgreSQL criado e validado
- [x] responsabilidade operacional LGPD/moderação definida
- [x] frequência de revisão da fila de moderação definida: uma vez por dia útil, com revisão extraordinária em caso de denúncia/risco/incidente
- [x] periodicidade de backup definida: diária enquanto houver uso real
- [x] retenção de backup definida: 30 dias
- [x] segunda cópia externa definida como obrigatória
- [x] teste de restauração definido: mensal em ambiente controlado
- [x] rotina de backup de Storage definida como obrigatória antes do uso real de evidências

## Confirmações obrigatórias de produção

- [ ] `DPO_CONTACT_EMAIL` aponta para endereço real, monitorado e sob controle do responsável pelo projeto.
- [ ] `LGPD_CONSENT_VERSION` está configurado com a versão efetivamente publicada.
- [ ] domínio e `APP_ORIGIN` correspondem ao ambiente oficial.
- [x] armazenamento persistente real do banco foi identificado e documentado.
- [x] armazenamento real de evidências foi identificado, com acesso privado.
- [ ] rotina recorrente de backup está efetivamente ativa em produção.
- [ ] segunda cópia do backup lógico fora da estação de trabalho foi efetivamente criada.
- [ ] primeiro teste periódico de restauração foi executado.
- [ ] rotina de backup dos objetos reais do Storage foi operacionalizada antes do uso real de evidências.
- [ ] retenção de logs do provedor foi revisada.
- [ ] fornecedores e papéis de tratamento foram registrados/revisados contra o ambiente efetivo.
- [ ] procedimento para titulares sem conta foi publicado internamente e o canal foi testado.
- [x] responsabilidade operacional por pedidos LGPD definida: `SUPER_ADMIN` como primário e `ADMIN` como substituto.
- [ ] canal `DPO_CONTACT_EMAIL` foi efetivamente testado pelo responsável operacional.
- [x] responsabilidade operacional de moderação definida: `SUPER_ADMIN` como primário e `ADMIN` como substituto.
- [x] frequência de revisão da fila de moderação foi definida e documentada.
- [ ] nenhuma imagem marcada `REQUER_ANONIMIZACAO` pode ser publicada antes de anonimização efetiva.
- [ ] base cívica não possui integração, exportação ou sincronização com CRM, campanha ou base eleitoral.
- [ ] revisão final da Política de Privacidade e Termos corresponde à configuração efetivamente implantada.
- [ ] CI verde no head final após as últimas atualizações documentais.

## Exceção transitória — evidências de teste

As quatro evidências atualmente existentes no bucket foram classificadas como dados de teste. Por isso, a ausência de uma cópia física externa desses quatro objetos não bloqueia o avanço do P0-D. Essa exceção deixa de valer antes da entrada de qualquer evidência real; nesse momento a rotina de backup de Storage deve estar implementada e testada.

## Rotina operacional aprovada

### LGPD e moderação

- primário: `SUPER_ADMIN`;
- substituto: `ADMIN`;
- revisão ordinária da fila: uma vez por dia útil;
- revisão extraordinária: sempre que houver denúncia, risco relevante, suspeita de exposição indevida ou incidente de privacidade.

### Backup e recuperação

- backup lógico do banco: diário enquanto houver uso real;
- retenção: 30 dias;
- segunda cópia: obrigatória fora da estação de trabalho, em armazenamento externo com acesso restrito e proteção adequada;
- integridade: SHA-256;
- teste de restauração: mensal, em ambiente controlado e sem sobrescrever produção;
- Storage real: backup dos objetos deve acompanhar a mesma rotina antes da entrada de evidências reais;
- responsável: `SUPER_ADMIN`, com `ADMIN` como substituto.

## Critério para retirar o PR de draft

O PR #48 só deve ser marcado como pronto para revisão quando os itens de produção críticos estiverem confirmados ou quando eventual exceção estiver documentada, justificada e aprovada pelo responsável pelo tratamento.

## Critério para merge

O merge na `main` exige, cumulativamente:

1. CI P0 verde no commit final da branch;
2. checklist operacional sem bloqueadores críticos;
3. confirmação do canal real de privacidade;
4. confirmação da estratégia recorrente de backup e retenção;
5. revisão da configuração de produção;
6. ausência de mudança posterior que invalide os testes jurídicos;
7. smoke pós-redeploy aprovado no ambiente efetivo.

## Próxima etapa

Antes do redeploy final:

1. testar o canal `DPO_CONTACT_EMAIL`;
2. confirmar `LGPD_CONSENT_VERSION` contra a versão publicada;
3. confirmar domínio e `APP_ORIGIN`;
4. revisar Política de Privacidade/Termos contra a configuração efetiva;
5. aguardar CI verde no head final;
6. executar redeploy;
7. validar `/ready`, `/api/public-config` e os fluxos críticos.

## Pós-deploy

Após deploy, executar smoke no ambiente de produção e verificar ao menos `/ready`, `/api/public-config`, Política de Privacidade, Termos, criação de demanda com aviso válido, bloqueio sem aviso e proteção das rotas administrativas.
