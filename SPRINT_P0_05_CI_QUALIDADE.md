# Sprint P0-05 — Qualidade e Entrega Contínua

## Objetivo

Estabelecer uma barreira mínima e automática de qualidade para proteger a branch `main` e dar segurança aos próximos blocos de evolução do FISCALIZE - VOCÊ CUIDANDO DA CIDADE.

## Entregas deste bloco

- Workflow de CI executado em pull requests para `main` e pushes na `main`.
- Instalação reprodutível de dependências com `npm ci`.
- Validação estática TypeScript com `npm run lint`.
- Build de produção com `npm run build`.
- Auditoria de dependências em severidade alta/crítica com `npm run audit:high`.
- Cancelamento automático de execuções antigas do mesmo fluxo para reduzir desperdício.
- Permissões do workflow reduzidas a leitura de conteúdo.

## Critérios de aceite

1. O workflow deve iniciar automaticamente em todo pull request direcionado à `main`.
2. Falha de TypeScript deve bloquear a validação.
3. Falha de build deve bloquear a validação.
4. Vulnerabilidades classificadas pelo npm audit no nível configurado devem provocar falha.
5. O pipeline deve usar Node.js 22, alinhado aos tipos de Node atualmente declarados no projeto.

## Próximos passos recomendados

Depois da estabilização deste bloco:

1. adicionar testes automatizados para autenticação, RBAC e fluxo de demandas;
2. separar testes de unidade, integração e smoke tests;
3. adicionar verificação automatizada de variáveis obrigatórias de ambiente;
4. revisar estratégia de execução do backend em produção;
5. configurar proteção da branch `main` exigindo o status de CI antes do merge.

## Rastreabilidade

Relacionado à issue #5.
