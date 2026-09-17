# P0-E — Crianças, adolescentes e adequação etária

Status: **implementação técnica em revisão na branch `juridico-p0e`**  
Versão: 2026-09-P0E  
Impacto em produção: **nenhum até merge e go-live aprovados**

## Objetivo

Definir e implementar, em branch isolada, a posição jurídica e técnica do FISCALIZE sobre acesso por crianças e adolescentes antes de qualquer ativação em produção.

Esta política interna considera a LGPD, especialmente o melhor interesse e o tratamento de dados de crianças e adolescentes, e a legislação brasileira aplicável a ambientes digitais, incluindo a Lei nº 15.211/2025 e sua regulamentação vigente. A ativação pública depende de revisão final da solução implementada.

## Classificação atual do serviço

O FISCALIZE é uma plataforma cívica privada e independente para registro e acompanhamento de demandas urbanas. O serviço **não é desenhado, anunciado ou direcionado especificamente a crianças**.

Isso, por si só, não exclui a possibilidade de acesso por menores de idade. Portanto, a operação deve considerar o risco de participação incidental de crianças e adolescentes.

## Decisão etária aprovada

A participação ativa autônoma no FISCALIZE será permitida a partir dos **16 anos**.

A regra aprovada é:

1. **menores de 16 anos:** podem acessar conteúdo público e informações gerais, mas não devem criar conta nem registrar demanda autonomamente;
2. **16 e 17 anos:** podem criar conta e registrar demandas, porém permanecem juridicamente adolescentes e recebem proteção reforçada;
3. **18 anos ou mais:** seguem o fluxo cívico normal, observadas LGPD, segurança, moderação e demais regras do FISCALIZE.

A referência de 16 anos foi adotada como critério cívico de produto por coincidir com a idade a partir da qual o ordenamento brasileiro admite participação eleitoral por voto facultativo. Essa referência **não equipara adolescentes de 16 e 17 anos a adultos** e não reduz as proteções específicas aplicáveis a menores de idade.

## Mecanismo etário implementado na branch

Para minimizar coleta de dados, foi adotada uma **declaração de faixa etária**, sem coleta padrão de data completa de nascimento, documento de identidade ou biometria.

Faixas técnicas:

- `UNDER_16` — menos de 16 anos;
- `AGE_16_17` — 16 a 17 anos;
- `AGE_18_PLUS` — 18 anos ou mais.

O frontend da branch apresenta as três faixas. O backend permanece a fonte de verdade: rejeita participação autônoma para `UNDER_16`, aplica proteção reforçada a `AGE_16_17` e permite fluxo normal para `AGE_18_PLUS`.

Documento de identidade, biometria ou outros mecanismos invasivos não devem ser usados como padrão sem nova avaliação específica de necessidade, proporcionalidade, risco e privacidade.

## Proteções reforçadas para usuários de 16 e 17 anos

Para adolescentes de 16 e 17 anos, a implementação prevê, no mínimo:

1. proibição absoluta de perfilamento político, segmentação eleitoral, propaganda individualizada ou inferência de preferência partidária;
2. proibição de publicação automática de nome, imagem, escola, endereço, contato ou outros identificadores;
3. moderação reforçada de fotos, texto livre e dados de terceiros;
4. minimização de dados por padrão;
5. revisão humana restrita quando houver saúde, violência, risco, dados sensíveis ou identificação de terceiros;
6. vedação de uso da participação cívica como sinal de apoio político ou eleitoral;
7. regras próprias de retenção, anonimização e exclusão quando o dado não for necessário à finalidade cívica;
8. tratamento de solicitações de responsáveis quando juridicamente cabível;
9. linguagem clara, adequada à compreensão do adolescente e sem técnicas de manipulação, pressão ou gamificação orientada a engajamento compulsivo.

## Regras gerais para menores

1. não criar campanhas, linguagem, gamificação ou aquisição direcionada especificamente a crianças;
2. não solicitar de forma deliberada dados pessoais de crianças menores de 16 anos para participação autônoma;
3. não utilizar dados cívicos de menores para perfilamento, segmentação política, propaganda eleitoral ou inferência de preferência;
4. não publicar automaticamente relatos, nomes, imagens ou evidências que possam identificar criança ou adolescente;
5. ao identificar participação de menor em conteúdo livre ou evidência, encaminhar o registro para revisão humana restrita;
6. aplicar minimização, melhor interesse, necessidade e proteção reforçada na decisão de conservar, anonimizar ou excluir o dado;
7. não usar documento de identidade ou biometria como mecanismo padrão de verificação etária sem avaliação específica de proporcionalidade e privacidade.

## Implementação técnica na branch

Nesta etapa foram adicionados:

- módulo central `src/server/agePolicy.ts`;
- migration `20260915160000_p0e_age_protection.sql`;
- validação backend em cadastro e intake;
- marcação de proteção e revisão reforçada para 16–17;
- declaração de faixa etária nas telas de cadastro e nova demanda;
- Termos de Uso e Política de Privacidade atualizados na branch;
- testes automatizados para `<16`, `16–17` e `18+`.

Nada disso deve chegar à produção antes de merge, migration revisada, atualização da versão do aviso de privacidade no ambiente e smoke pós-deploy.

## Bloqueio de go-live específico

A regra 16+ está **aprovada e implementada na branch**, mas sua ativação em produção permanece bloqueada até:

- CI verde no head atual;
- revisão jurídica e funcional final;
- revisão/aplicação controlada da migration;
- atualização de `LGPD_CONSENT_VERSION` para `2026-09-v2` no ambiente de produção antes do deploy final;
- testes de privacidade e segurança;
- smoke das três faixas etárias;
- aprovação do checklist P0-E.
