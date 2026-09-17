# Plano inicial de resposta a incidentes de dados — FISCALIZE

Versão: 2026-09-P0

## Objetivo

Definir uma resposta mínima, rastreável e proporcional para incidentes que possam afetar confidencialidade, integridade ou disponibilidade de dados pessoais tratados pelo FISCALIZE.

## Exemplos de incidente

- acesso administrativo indevido;
- vazamento de banco, backup ou arquivo;
- exposição pública acidental de contato, descrição ou evidência;
- credencial, token ou segredo comprometido;
- alteração ou exclusão indevida de registros;
- envio de informação pessoal a destinatário incorreto;
- comprometimento de fornecedor com impacto nos dados do FISCALIZE.

## Resposta operacional

1. **Conter**: interromper a exposição, revogar credenciais, bloquear rota, chave ou integração afetada.
2. **Preservar evidências**: registrar horário, sistemas afetados, logs disponíveis e ações realizadas, sem ampliar desnecessariamente a coleta.
3. **Avaliar**: identificar categorias de dados, quantidade aproximada de titulares, risco de dano e alcance do incidente.
4. **Corrigir**: aplicar correção técnica, redefinir segredos e validar que a causa imediata foi neutralizada.
5. **Decidir comunicação**: avaliar obrigações de comunicação à ANPD e aos titulares conforme a regulamentação vigente e o risco relevante identificado.
6. **Registrar**: manter relatório interno com causa, impacto, decisões, responsáveis e medidas preventivas.
7. **Revisar**: atualizar controles e testes para evitar recorrência.

## Severidade interna

- **S1 — crítica**: dados pessoais expostos publicamente, acesso indevido a base, credenciais administrativas comprometidas ou risco elevado aos titulares.
- **S2 — alta**: incidente confirmado com exposição limitada ou perda relevante de integridade/disponibilidade.
- **S3 — moderada**: evento contido, sem evidência de acesso não autorizado, mas que exige correção e registro.
- **S4 — baixa**: falha sem impacto material em dados pessoais.

## Regras P0

- Incidentes S1 e S2 devem gerar registro formal imediato.
- Segredos de produção nunca devem ser reutilizados em desenvolvimento.
- Backups devem ter acesso restrito e ciclo de retenção definido.
- Não ocultar incidente relevante dos titulares quando houver dever legal de comunicação.
- A decisão de comunicação deve considerar a regulamentação vigente da ANPD no momento do incidente.

## Informações mínimas do registro

- data e hora de detecção;
- sistema afetado;
- descrição do evento;
- dados e titulares potencialmente envolvidos;
- origem provável;
- medidas de contenção;
- avaliação de risco;
- decisão sobre comunicação;
- correção permanente;
- data de encerramento.

> Antes da abertura pública ampla, este plano deve receber responsáveis e canais de escalonamento concretos.