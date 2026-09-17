# Matriz de QA visual — FISCALIZE

## Objetivo

Produzir evidência visual revisável da experiência pública sem criar previews Vercel adicionais.

## Estratégia

1. Os gates rápidos já existentes continuam obrigatórios: `test:mobile-ui`, `test:brand-ui`, `test:devices` e `test:performance`.
2. Um workflow separado de GitHub Actions roda Playwright/Chromium somente quando arquivos públicos de UI mudam.
3. O workflow captura screenshots reais e envia os PNGs como artefato por 14 dias.
4. As APIs públicas usadas na jornada são mockadas para que o teste não grave telemetria e não use dados reais.
5. O artefato é inspecionado antes do merge do pacote consolidado.

## Viewports de captura

- Mobile compacto: **375 × 667**
- Tablet/dobrável: **768 × 968**
- Desktop: **1536 × 864**

A matriz estática existente continua cobrindo os demais tamanhos do projeto.

## Superfícies protegidas

- `/` — hierarquia da Home e CTAs públicos.
- `/demandas/nova` — progresso, privacidade, campos e CTA de envio.
- `/protocolo?codigo=AM-VISUAL-QA` — situação atual e histórico com fixture determinística.

## Privacidade e determinismo

- Nenhum cidadão real é usado.
- Nenhum protocolo real é consultado.
- `/api/mobile-events` é interceptado e retorna `204` sem persistir dados.
- `/api/public-config` e `/api/demandas/protocolo/*` usam fixtures locais.
- Idioma `pt-BR`, timezone `America/Manaus`, tema claro e movimento reduzido são fixados.
- O spec não acessa `vercel.app`.

## Economia de Vercel

Esse QA roda no GitHub Actions. Ele não cria deployment na Vercel. Quando o pacote completo for enviado à branch uma única vez, esse mesmo push poderá gerar simultaneamente o único preview Vercel consolidado e o artefato visual do GitHub para revisão antes do merge.
