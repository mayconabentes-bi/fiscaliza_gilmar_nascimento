# Auditoria Jurídica P0 — FISCALIZE / FISCALIZE - VOCÊ CUIDANDO DA CIDADE

Data-base: 14/09/2026

## Escopo e natureza

O FISCALIZE é tratado nesta auditoria como iniciativa cívica privada e independente, mantida por Maycon Bentes como pessoa natural. Não integra nem representa Prefeitura de Manaus, Câmara Municipal de Manaus, Governo do Amazonas, partido político, mandato ou órgão público.

A auditoria usa abordagem conservadora: para a operação pública, o projeto deve se comportar como controlador de dados pessoais e aplicar LGPD, segurança por padrão, transparência e separação de finalidade entre participação cívica e eventual atividade político-eleitoral futura.

## Classificação

- **CONFORME**: controle adequado para a fase atual.
- **AJUSTAR**: não impede teste controlado, mas precisa de melhoria antes de escala.
- **RISCO**: exposição jurídica ou de privacidade relevante.
- **BLOQUEAR LANÇAMENTO**: requisito que deve ser resolvido antes de abertura pública ampla.

## Achados por arquivo

### `DECLARACAO_INDEPENDENCIA_PULSO.md` — CONFORME

Define a natureza privada e independente, nega representação de órgãos públicos e separa participação cívica de apoio político. Deve permanecer como princípio vinculante de produto.

### `ESTRATEGIA_CAMPANHA_2028.md` — RISCO

O documento prevê futura operação eleitoral e, ao mesmo tempo, estabelece separação de bases e veda reutilização automática dos dados cívicos. A separação é correta, mas a existência de uma finalidade eleitoral futura exige controles técnicos verificáveis. Dados cívicos não podem migrar para base de campanha por simples exportação, sincronização ou enriquecimento.

**P0:** manter núcleo estratégico sob autenticação administrativa; criar banco/credenciais distintos antes de qualquer operação eleitoral real; proibir exportação de contatos cívicos para campanha.

### `src/pages/Home.tsx` — CONFORME / AJUSTAR

A página informa que o FISCALIZE não substitui canais oficiais e se apresenta como uso independente. A linguagem deve continuar evitando aparência de serviço público oficial.

**Ajustar:** repetir em pontos de alta conversão que o protocolo é interno do FISCALIZE, não protocolo de órgão público.

### `src/pages/NovaDemanda.tsx` — AJUSTAR

Há aviso de minimização, contato opcional e ciência de privacidade. O formulário ainda exige nome; a necessidade dessa obrigatoriedade deve ser revisada em P1.

**P0:** o backend deve rejeitar envio sem ciência de privacidade; fotos devem receber aviso explícito sobre terceiros; não prometer armazenamento de foto se o backend não persistir a evidência.

### `src/pages/Privacidade.tsx` — BLOQUEAR LANÇAMENTO

A página atual reconhece que canais formais e prazos de guarda ainda não estão definidos. Antes de escala pública, a política deve identificar controlador, canal de privacidade, categorias de dados, finalidades, bases legais, fornecedores, retenção, direitos, segurança, crianças/adolescentes e regra de separação eleitoral.

### `src/pages/Termos.tsx` — BLOQUEAR LANÇAMENTO

Os termos atuais são resumidos e de fase de testes. Precisam disciplinar natureza independente, limites do serviço, protocolo interno, moderação, conteúdo de terceiros, emergência, propriedade intelectual, disponibilidade e relação com órgãos públicos.

### `src/components/LGPDConsent.tsx` — CONFORME / AJUSTAR

O componente funciona como aviso de privacidade, não como consentimento geral. Isso é desejável. Não deve ser descrito como autorização universal para tratamento.

### `src/server/routes.ts` — RISCO

O backend recebe demandas públicas e já possui validação de entrada. Os endpoints de métricas e relatórios são protegidos em `server.ts` por autenticação interna.

**P0:** validar no servidor a ciência de privacidade; registrar versão do aviso e timestamp associados à demanda. Não confiar somente no checkbox do frontend.

### `src/server/db.ts` — RISCO

A base cívica contém identificadores, contatos, conteúdo livre e estruturas de participação. Há campos que podem formar histórico de comportamento do usuário.

**P0:** registrar versão/timestamp do aviso nas demandas; documentar retenção; impedir integração direta com base eleitoral futura.

### `server.ts` — CONFORME / AJUSTAR

Há Helmet, CORS, limites de payload, rate limiting e proteção de rotas administrativas. Métricas e relatórios não estão expostos publicamente.

**Ajustar:** manter logs mínimos e documentar prazo de retenção; revisar incidentes e backups; garantir segredos distintos entre ambientes.

### `src/lib/mobileAnalytics.ts` — AJUSTAR

O analytics envia evento, origem e ação, sem nome ou contato no código cliente analisado. Ainda é necessário documentar metadados processados pelo servidor e infraestrutura (por exemplo IP, user-agent e logs de plataforma).

## Bloqueadores de lançamento público amplo

1. Política de Privacidade completa e publicada.
2. Termos de Uso completos e publicados.
3. Backend registrando ciência/versionamento do aviso para demandas.
4. Política de retenção e descarte aprovada.
5. Canal de exercício de direitos do titular definido.
6. Procedimento de incidentes de segurança documentado.
7. Política de moderação para relatos com acusações, dados pessoais e conteúdo ilícito.
8. Regra técnica de separação entre base cívica e qualquer base eleitoral futura.
9. Revisão do fluxo de fotos/evidências, incluindo terceiros e efetiva persistência.

## Regra de finalidade

É proibido transformar automaticamente participação cívica em relacionamento eleitoral. Registrar demanda, consultar protocolo, participar de pesquisa cívica ou fornecer contato para retorno sobre um caso não autoriza inclusão em lista de campanha, propaganda política individualizada ou inferência de preferência política.

## Próximos blocos

- P0-A: textos jurídicos e versionamento de aviso.
- P0-B: retenção, direitos do titular e incidente de segurança.
- P0-C: moderação e evidências fotográficas.
- P0-D: segregação técnica cívico-eleitoral e testes de não regressão.

> Este documento é uma auditoria técnica-jurídica de produto e não substitui parecer jurídico individual de advogado regularmente constituído.