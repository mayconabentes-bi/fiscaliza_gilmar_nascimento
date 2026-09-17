# Política de evidências — FISCALIZE

Versão: 2026-09-P0-C

## Regra central

Fotos enviadas por moradores são evidências privadas de apoio ao acompanhamento da demanda. O envio não autoriza publicação automática.

## Fluxo

`UPLOAD → PENDENTE → APROVADA_PRIVADA | REJEITADA | REQUER_ANONIMIZACAO`

- `PENDENTE`: arquivo recebido e ainda não revisado;
- `APROVADA_PRIVADA`: pode permanecer anexado ao caso para análise interna, sem tornar-se público automaticamente;
- `REJEITADA`: arquivo é removido do armazenamento operacional;
- `REQUER_ANONIMIZACAO`: o arquivo não pode ser publicado enquanto contiver elementos que exijam tratamento adicional.

## Elementos que exigem cautela

A revisão deve observar especialmente rostos, crianças e adolescentes, documentos, placas de veículos, números de residência, informações médicas, telas de telefone, dados bancários, conteúdo íntimo, pessoas em situação de vulnerabilidade ou qualquer informação pessoal desnecessária para demonstrar o problema.

## Publicação

Nesta fase P0-C não existe endpoint público de entrega das evidências originais. Qualquer futura funcionalidade de publicação deverá usar cópia derivada e moderada, preferencialmente com anonimização, sem expor o arquivo original.

## Retenção

Evidências vinculadas a demandas concluídas ou indeferidas possuem prazo operacional padrão de 365 dias após a última atualização. O arquivo pode ser eliminado antes quando perder sua finalidade. Preservação além do prazo exige motivo concreto e documentável.

## Segurança

O nome de arquivo é derivado do identificador interno da demanda e o caminho de armazenamento não deve ser aceito diretamente de entrada externa. Operações de exclusão usam apenas o basename armazenado para reduzir risco de manipulação de caminho.
