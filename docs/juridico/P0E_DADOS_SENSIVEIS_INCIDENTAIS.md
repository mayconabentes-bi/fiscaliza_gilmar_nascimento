# P0-E — Dados sensíveis e dados de terceiros recebidos incidentalmente

Status: **controle interno para revisão e implementação**  
Versão: 2026-09-P0E  
Impacto público nesta branch: **nenhum**

## Objetivo

Definir como o FISCALIZE deve tratar dados pessoais sensíveis e dados de terceiros que possam ser inseridos espontaneamente em descrições, anexos ou evidências, mesmo quando a plataforma não solicita esses dados.

## Princípio central

O fato de o FISCALIZE não solicitar dados sensíveis não elimina o risco de recebê-los em campos de texto livre ou fotografias. Quando isso ocorrer, a operação deve aplicar necessidade, minimização, segurança, prevenção e acesso restrito.

## Exemplos de conteúdo de maior risco

Incluem, entre outros:

- dados sobre saúde, deficiência ou prontuários;
- origem racial ou étnica;
- convicção religiosa;
- opinião ou filiação política;
- filiação sindical;
- vida sexual ou orientação sexual;
- dado genético ou biométrico;
- documentos oficiais, CPF, RG, cartões ou credenciais;
- imagens de crianças e adolescentes;
- endereço residencial preciso de terceiro;
- placas de veículos e outros identificadores quando desnecessários;
- acusações nominativas envolvendo crime, violência ou fatos potencialmente difamatórios.

## Tratamento operacional

Ao identificar conteúdo dessa natureza:

1. **não publicar automaticamente**;
2. limitar o acesso ao menor número de pessoas necessário;
3. avaliar se o elemento sensível é indispensável para compreender ou encaminhar a demanda;
4. se não for necessário, anonimizar, ocultar ou excluir o trecho/arquivo;
5. se for necessário conservar, registrar a justificativa, finalidade, acesso e prazo de retenção;
6. evitar replicação em relatórios, analytics, estratégia, exportações administrativas amplas ou materiais de comunicação;
7. não utilizar o dado para segmentação política, preferência eleitoral, prioridade persuasiva ou enriquecimento de perfil;
8. registrar a decisão de moderação quando houver evidência fotográfica ou conteúdo de alto risco.

## Evidências fotográficas

Fotos permanecem privadas por padrão. A mera aprovação de uma evidência significa apenas que ela pode permanecer disponível para uso operacional restrito; não autoriza publicação pública.

Quando a imagem contiver pessoa identificável, criança/adolescente, documento, placa, prontuário ou outro identificador desnecessário, deve-se preferir rejeição, anonimização ou substituição por resumo textual.

## Base jurídica e revisão

A base jurídica deve ser avaliada conforme a finalidade concreta e a natureza do dado. Dados sensíveis exigem análise compatível com as hipóteses específicas previstas na LGPD, não sendo suficiente reutilizar automaticamente a base jurídica de um dado pessoal comum.

Em caso de dúvida sobre necessidade ou hipótese de tratamento, prevalece a redução do tratamento até revisão pelo responsável jurídico/operacional.

## Resposta a incidentes e exposição indevida

Se houver suspeita de exposição pública, acesso indevido, compartilhamento não autorizado ou vazamento de dado sensível:

- preservar evidências do incidente;
- restringir imediatamente o acesso quando possível;
- acionar o plano de incidentes;
- avaliar risco ou dano relevante;
- avaliar eventual comunicação a titulares e à ANPD conforme regulamentação vigente;
- registrar causa, impacto, correção e medida preventiva.

## Critério de encerramento P0-E

Este protocolo estará apto a virar controle público/automatizado somente depois de:

- revisão jurídica final;
- definição do fluxo técnico de anonimização/moderação;
- testes automatizados;
- confirmação de que relatórios e módulos estratégicos não recebem conteúdo sensível bruto;
- atualização de documentação pública quando necessária.
