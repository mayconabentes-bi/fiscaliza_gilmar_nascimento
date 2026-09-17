# Fronteira cívico-eleitoral — FISCALIZE

Versão: 2026-09-P0-C

## Princípio

Dados pessoais fornecidos para participação cívica não podem ser convertidos automaticamente em base de campanha, lista de apoiadores, perfil político ou ferramenta de persuasão individual.

## Interface permitida ao núcleo estratégico

A camada estratégica pode receber somente agregados territoriais autorizados pela aplicação. A interface técnica criada para esse fim retorna exclusivamente:

- bairro;
- categoria;
- total agregado.

Nenhum nome, contato, protocolo, descrição livre, conta, evidência ou identificador individual é retornado.

## Regra de tamanho mínimo

Grupos com menos de 5 registros não são retornados por padrão. O limite é configurável por `CIVIC_AGGREGATE_MIN_GROUP_SIZE`, mas não deve ser reduzido sem nova avaliação de risco de reidentificação.

## Proibições

É vedado usar a base de demandas para:

- criar lista de eleitores, apoiadores ou opositores;
- estimar intenção de voto ou preferência partidária;
- selecionar indivíduos para propaganda política;
- cruzar relato cívico com atributos sensíveis para persuasão;
- exportar nome, contato, protocolo ou descrição para operação eleitoral;
- pontuar cidadãos por probabilidade de apoio.

## Separação futura

Se houver operação eleitoral futura, ela deverá possuir coleta, finalidade, base legal, avisos, controles de acesso e armazenamento próprios. Não deve existir sincronização automática com a base cívica.

## Teste de não regressão

O teste `tests/legal-p0c-boundary.mjs` verifica que a interface agregada aplica tamanho mínimo de grupo e que não expõe nome, contato ou protocolo. Esse teste é uma barreira de engenharia e não substitui revisão jurídica periódica.
