# SPRINT P0-02 — Fluxo de Demandas com Protocolo

## Objetivo

Entregar o fluxo mínimo operacional do MVP FISCALIZE - VOCÊ CUIDANDO DA CIDADE:

1. cidadão registra uma demanda pública;
2. sistema gera protocolo único;
3. cidadão consulta o andamento pelo protocolo;
4. gestor institucional visualiza e filtra demandas;
5. gestor altera status;
6. dashboard executivo contabiliza demandas reais.

## Entregas incluídas

- Tabela `demandas`.
- Tabela `historico_status_demandas`.
- Tabela `denuncias`, necessária para rotas de governança já existentes.
- Tabela `registros_moderacao`, necessária para rotas de moderação já existentes.
- Endpoint `POST /api/demandas`.
- Endpoint `GET /api/demandas/protocolo/:protocolo`.
- Endpoint `GET /api/admin/demandas`.
- Endpoint `PATCH /api/admin/demandas/:id/status`.
- Endpoint `GET /api/demandas/metricas`.
- Página `/demandas/nova`.
- Página `/protocolo`.
- Página `/admin/demandas`.
- Dashboard institucional baseado em métricas de demandas reais.

## Critério de aceite

- [ ] Registrar demanda sem login.
- [ ] Gerar protocolo no formato `AM-AAAAMMDD-XXXXXX`.
- [ ] Consultar protocolo publicamente.
- [ ] Listar demandas em painel institucional autenticado.
- [ ] Atualizar status administrativo.
- [ ] Registrar histórico de status.
- [ ] Registrar log de auditoria.
- [ ] Dashboard exibir total, pendentes, concluídas e críticas.

## Status

Preparado para aplicação local via patch e posterior push para branch `sprint-p0-02-demandas`.
