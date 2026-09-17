# Engajamento cívico transparente — incremento 1

Este incremento aplica mecanismos de engajamento apenas para reduzir fricção e tornar a jornada de registro mais previsível.

## Implementado

- progresso explícito em três etapas: Localize, Descreva e Confirme;
- feedback visual quando cada etapa essencial é preenchida;
- indicador sem contagem regressiva, pontuação, ranking ou penalidade;
- eventos agregados de conclusão das etapas (`form_step_location`, `form_step_details`, `form_step_review`);
- preservação do funil agregado por `src`/`acao`, sem incluir nome, contato, descrição, foto ou perfil individual;
- manutenção das barreiras contra dados de segmentação política e outros campos sensíveis já recusados pelo backend.

## Guardrails

Não usar neste fluxo:

- urgência artificial;
- prova social inventada;
- streaks, rankings ou recompensas variáveis;
- mensagens de culpa ou pressão;
- personalização por preferência política, intenção de voto ou perfil eleitoral;
- associação entre conclusão do registro e apoio político.

O objetivo é melhorar a usabilidade do serviço cívico e a capacidade de medir, de forma agregada, onde o formulário gera fricção.
