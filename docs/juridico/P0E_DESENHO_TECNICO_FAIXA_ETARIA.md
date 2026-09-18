# P0-E — Desenho técnico da faixa etária 16+

Status: **implementado na branch `juridico-p0e`, aguardando revisão final**  
Versão: 2026-09-P0E  
Impacto em produção nesta etapa: **nenhum**

## Decisão aprovada

O FISCALIZE adotará a seguinte regra quando o go-live P0-E for aprovado:

- **menos de 16 anos**: navegação pública permitida, sem criação autônoma de conta e sem envio autônomo de demanda;
- **16 a 17 anos**: participação ativa permitida, com proteção reforçada;
- **18 anos ou mais**: fluxo cívico normal, sujeito às regras gerais de privacidade e segurança.

A referência de 16 anos é uma decisão cívica de produto alinhada à idade em que o ordenamento brasileiro admite voto facultativo. Ela não transforma adolescentes de 16 e 17 anos em adultos e não afasta as proteções específicas aplicáveis a menores de 18 anos.

## Princípio de minimização

A implementação não deve coletar data completa de nascimento, CPF, RG, biometria ou imagem de documento como padrão.

O mecanismo adotado é uma **declaração de faixa etária**, sem data de nascimento ou idade exata, com os valores:

- `UNDER_16`
- `AGE_16_17`
- `AGE_18_24`
- `AGE_25_34`
- `AGE_35_44`
- `AGE_45_59`
- `AGE_60_PLUS`

O código `AGE_18_PLUS` permanece aceito apenas para compatibilidade com contas e demandas anteriores à classificação detalhada e não é oferecido em novos formulários.

O sistema armazena somente a classificação necessária para aplicar as regras de acesso, proteção e estatística agregada. O backend permanece a fonte de verdade.

## Pontos de entrada implementados

### Cadastro cidadão

O formulário de criação de conta inclui a pergunta de faixa etária. O POST `/api/auth/register/cidadao` recebe `faixa_etaria` e aplica a validação central.

Regras:

- `UNDER_16` é bloqueado no frontend e rejeitado novamente pelo backend;
- ausência ou valor inválido retorna erro de validação;
- `AGE_16_17` cria conta com `protecao_reforcada = true`;
- as faixas adultas detalhadas (`18–24`, `25–34`, `35–44`, `45–59` e `60+`) seguem o fluxo normal;
- `AGE_18_PLUS` continua válido somente para registros históricos;
- não é registrada data de nascimento.

### Envio público de demanda

O formulário de nova demanda também coleta a faixa etária, inclusive para usuário sem conta.

Regras:

- `UNDER_16` é rejeitado para envio autônomo;
- `AGE_16_17` marca a demanda para proteção e revisão reforçadas;
- as faixas adultas detalhadas seguem o fluxo normal;
- `AGE_18_PLUS` continua válido somente para registros históricos;
- a faixa etária não é exposta na consulta pública por protocolo.

## Estado interno implementado

A migration `supabase/migrations/20260915160000_p0e_age_protection.sql` adiciona os campos mínimos de faixa etária e proteção reforçada. A migration `supabase/migrations/20260918143000_age_intelligence_bands.sql` amplia de forma backward-compatible as faixas aceitas, sem introduzir data de nascimento, idade exata, documento ou biometria.

Registros legados podem permanecer sem faixa etária até nova declaração. Não inferir faixa etária por inteligência artificial, comportamento, redes sociais, nome, foto ou dados de terceiros.

## Proteção reforçada para 16–17

Quando `faixa_etaria = AGE_16_17`, o backend e os fluxos administrativos devem aplicar, no mínimo:

1. nenhuma publicação automática de nome, contato, escola, endereço, imagem ou identificador;
2. evidência fotográfica permanece privada e sujeita a moderação;
3. conteúdo que mencione saúde, violência, abuso, risco, localização precisa, dados sensíveis ou terceiros recebe revisão humana reforçada;
4. vedação de perfilamento político, segmentação eleitoral, inferência de preferência ou transferência para base de campanha;
5. minimização de dados antes de qualquer encaminhamento externo;
6. prioridade para anonimização ou supressão de identificadores quando não necessários;
7. acesso administrativo sob menor privilégio e trilha de auditoria.

A faixa etária não deve aparecer em relatórios públicos. No Radar privado, somente agregados estatísticos municipais podem ser exibidos, com limiar mínimo e supressão de grupos pequenos, sem cruzamento com identidade, protocolo ou endereço.

## UX implementada na branch

A pergunta é exibida como **Faixa etária** com as opções:

- Menos de 16 anos
- 16 a 17 anos
- 18 a 24 anos
- 25 a 34 anos
- 35 a 44 anos
- 45 a 59 anos
- 60 anos ou mais

Para menores de 16 anos, a interface explica de forma neutra que o conteúdo público pode ser consultado, mas a participação autônoma está disponível a partir dos 16 anos.

Para 16–17 anos, a interface informa a proteção reforçada e orienta a evitar escola, endereço residencial, dados de saúde, documentos e outros dados pessoais desnecessários.

## Telemetria e analytics

A faixa etária não deve ser enviada aos eventos agregados de aquisição, funil ou origem de QR como dimensão de segmentação.

Não inferir faixa etária por inteligência artificial nem usar a faixa declarada para persuasão política.

## Segurança contra bypass

A validação existe no backend tanto no cadastro quanto no intake público. Bloqueios visuais são apenas uma camada adicional.

## Testes

A branch inclui:

- `test:legal-p0e` — contrato jurídico e textos públicos;
- `test:p0e-tech` — contrato técnico entre módulo, backend e migration;
- `test:p0e-age-flow` — execução real da política de proteção para `<16`, `16–17` e participação adulta;
- `test:age-intelligence` — valida faixas detalhadas, compatibilidade legada, cobertura, diversidade e supressão estatística.

## Critérios para ativação pública

A regra 16+ somente poderá ir à produção quando:

- CI do head atual estiver verde;
- Política de Privacidade e Termos estiverem revisados;
- migration estiver revisada e aplicada de forma controlada;
- `LGPD_CONSENT_VERSION` de produção estiver em `2026-09-v2`;
- backend e frontend estiverem consistentes;
- testes das três faixas estiverem aprovados;
- consulta por protocolo continuar sem expor faixa etária;
- analytics continuar sem dimensão etária para segmentação;
- revisão jurídica final e checklist P0-E forem aprovados.

## Regra desta branch

As mudanças podem existir e ser testadas em preview, mas **não devem ser mescladas nem ativadas em produção** até a revisão final e o go-live controlado.
