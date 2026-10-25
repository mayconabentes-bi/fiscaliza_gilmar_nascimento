# Central de Encaminhamentos Cívicos — fase 1

## Objetivo
Registrar e acompanhar, como projeto cívico independente, encaminhamentos formais de demandas recebidas da população de Manaus. O código foi estruturado sem qualquer finalidade eleitoral ou compartilhamento automático com políticos/gabinetes.

## Entregue nesta branch
- Persistência privada em PostgreSQL, com histórico de eventos e RLS habilitada;
- Rotas internas para criar, consultar e atualizar encaminhamentos da demanda;
- Canais: ouvidoria, portal, e-mail, presencial, ofício, outro;
- Transições de situação validadas e referência externa obrigatória ao marcar como protocolado;
- Acesso limitado ao perfil ADMIN na fase cívica;
- Sem publicação automática de dados ou comprovantes, sem envio externo e sem alteração das demandas existentes.

## Pendente antes de liberar a funcionalidade
- Aplicar migração no ambiente de homologação e validar as políticas e privilégios SQL;
- Construir interface de central de encaminhamentos integrada à Triagem;
- Criar geração de ofício, armazenamento privado de comprovantes, consulta de histórico e filtros;
- Criar campo de atualização pública com moderação específica e sem exposição de observações internas;
- Validar concorrência, auditoria, testes end-to-end, mobile, isolamento e deploy em homologação.

## Critérios de aceite
- [x] Migração aplicada em homologação (Supabase fiscalize-homologacao; confirmação de tabelas e RLS)
- [ ] Acesso negado a cidadão, visitantes e staff fora da permissão
- [ ] Criação e atualização realizadas com histórico
- [ ] Protocolo FISCALIZE permanece independente do protocolo externo
- [ ] Nenhum dado sensível divulgado na rota pública
- [ ] Testes de segurança e regressão aprovados
- [ ] Revisão final antes do merge na main
- [x] CI completa e migration smoke aprovados no commit f895dbc (antes desta atualização documental)
- [x] Preview isolado publicado no Vercel para o projeto `fiscalizacidade`
- [ ] Teste manual no celular e desktop — liberado para execução após CI, Visual QA e migration smoke verdes
