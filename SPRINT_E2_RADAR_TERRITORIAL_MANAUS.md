# Sprint E2 — Radar Territorial Manaus

## Objetivo

Consolidar dados públicos territoriais e administrativos de Manaus em uma API interna única e em um painel restrito de inteligência territorial agregada.

O Radar é destinado a diagnóstico público, fiscalização, formulação de propostas e priorização territorial. Não cria perfis políticos individuais nem usa atributos sensíveis para persuasão.

## E2.1 — GeoManaus + bairros

**Status: implementado.**

Fonte principal:

- `CCC/CAMADAS_CCC_2025/FeatureServer/3` — Bairros IMPLURB.

Endpoint interno:

- `GET /api/radar/manaus/bairros`

## E2.2 — Obras SEMINF

**Status: implementado.**

Fonte principal:

- `PORTAL_TRANSPARENCIA/SEMINF_OBRAS_PORTAL_CIDADAO_SRGS/MapServer/0` — Obras Prefeitura de Manaus.

Endpoint interno:

- `GET /api/radar/manaus/obras`
- filtro opcional: `?status=PARALISADA`

## E2.3 — Saúde SEMSA + escolas SEMED

**Status: implementado.**

Fontes:

- `CCC/CAMADAS_CCC_2025/FeatureServer/17` — Unidades de Saúde Municipais SEMSA;
- `CCC/CAMADAS_CCC_2025/FeatureServer/20` — Escolas Municipais SEMED.

Endpoint interno:

- `GET /api/radar/manaus/equipamentos`

## E2.4 — Transparência: contratos, despesas e licitações

**Status: conector preparado; endpoint JSON deve ser configurado.**

Variável:

- `MANAUS_TRANSPARENCIA_API_URL`

O sistema não usa scraping oculto nem presume uma URL de API. O painel apresenta o status da fonte até que um endpoint oficial/documentado seja definido.

## E2.5 — CMM/SAPL e inteligência legislativa

**Status: integrado.**

Base padrão:

- `https://sapl.cmm.am.gov.br/api`

Endpoint interno:

- `GET /api/radar/manaus/legislativo?ano=2026`

A base pode ser substituída via `CMM_SAPL_API_BASE` se a Câmara alterar a instalação.

## E2.6 — TCE-AM + ObrasGov

**Status: conectores preparados para endpoints documentados.**

Variáveis:

- `TCE_AM_API_URL`
- `OBRASGOV_API_URL`

Para ObrasGov deve ser utilizada a nova plataforma pública (`api-publica.obrasgov.gestao.gov.br`), evitando dependência da API legada após o período oficial de migração.

## E2.7 — Cruzamento com demandas da plataforma

**Status: implementado.**

Endpoints:

- `GET /api/radar/manaus/demandas`
- `GET /api/radar/manaus/resumo`

O resumo agrega:

- quantidade de bairros disponíveis na fonte cartográfica;
- obras municipais;
- unidades municipais de saúde;
- escolas municipais;
- total de demandas locais;
- ranking agregado de demandas por bairro;
- ranking agregado de temas.

## Interface

Nova rota restrita:

- `/radar-manaus`

Acesso:

- `GESTOR`
- `ADMIN`

## Resiliência

As consultas externas usam:

- timeout;
- cache em memória de 10 minutos;
- falha isolada por fonte;
- identificação explícita da disponibilidade.

Assim, indisponibilidade temporária de uma fonte pública não derruba todo o Radar.

## Próxima evolução

1. confirmar/documentar endpoints JSON do Portal da Transparência de Manaus e TCE-AM;
2. mapear o modelo de dados da nova API ObrasGov e ativar consulta por município;
3. normalizar nomes de bairros entre GeoManaus e demandas internas;
4. geocodificar obras/equipamentos por bairro para calcular cobertura territorial;
5. criar séries temporais e indicadores por tema;
6. adicionar testes automatizados dos adapters e contratos das APIs.
