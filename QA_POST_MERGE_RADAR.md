# QA pós-merge — Radar Territorial Manaus

Este arquivo existe para disparar e registrar a validação automatizada pós-merge do Sprint E2.

Escopo do pipeline:

- instalação reprodutível com `npm ci`;
- validação TypeScript com `npm run lint`;
- build de produção com `npm run build`;
- auditoria de dependências com nível high/critical.

A validação funcional do Radar considera também a presença das rotas `/api/radar/manaus/*`, a página `/radar-manaus` e o comportamento resiliente das fontes externas.
