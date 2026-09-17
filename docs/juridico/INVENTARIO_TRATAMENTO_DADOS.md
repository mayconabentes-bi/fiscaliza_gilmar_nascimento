# Inventário de tratamento de dados — FISCALIZE

Versão: 2026-09-P0E

## Controlador

Controlador operacional: **Maycon Bentes**, pessoa natural responsável pelo projeto cívico independente FISCALIZE.

Canal de privacidade: definido por `DPO_CONTACT_EMAIL` no ambiente de produção e publicado pela aplicação.

## Regra de interpretação

Este inventário registra a **base jurídica de trabalho** por finalidade. A base indicada deve ser confirmada na operação concreta e não autoriza tratamento incompatível, excessivo ou para finalidade nova.

Dados pessoais sensíveis recebidos incidentalmente exigem análise própria e não herdam automaticamente a base usada para dados pessoais comuns.

## Matriz finalidade × dados × base jurídica × retenção

| Operação | Dados principais | Finalidade | Base jurídica de trabalho | Acesso | Retenção / descarte | Estado P0-E |
|---|---|---|---|---|---|---|
| Registro de demanda | nome, contato opcional, município, bairro, categoria, descrição, protocolo | receber, organizar e acompanhar relato cívico solicitado pelo titular | procedimentos a pedido do titular e/ou legítimo interesse, conforme caso concreto e teste de necessidade | operação/admin | conforme política de retenção e necessidade do acompanhamento | revisar nome obrigatório e conteúdo livre |
| Histórico da demanda | protocolo, status, datas, observações operacionais | rastreabilidade, integridade e prestação de informação sobre o acompanhamento | legítimo interesse, exercício regular de direitos e obrigação aplicável, conforme caso | operação/admin; parte limitada via protocolo | vinculada à demanda + período de segurança/auditoria definido | observação interna nunca pública |
| Conta de cidadão | nome, e-mail, município, bairro, hash de senha, status | autenticação, segurança e serviços da conta | procedimentos a pedido do titular; legítimo interesse para segurança | sistema/admin | enquanto conta ativa + prazo técnico/legal necessário | fluxo etário pendente de decisão P0-E |
| Analytics mobile agregado | evento, `src`, `acao`, timestamp e metadados técnicos mínimos | medir funil, origem e funcionamento sem perfil individual | legítimo interesse sujeito a minimização e teste de balanceamento | operação/admin | mínimo necessário | não incluir nome, contato ou preferência política |
| Logs de segurança | IP e metadados técnicos gerados por servidor/provedor | segurança, prevenção de abuso, investigação e diagnóstico | legítimo interesse e exercício regular de direitos, conforme contexto | acesso restrito | prazo mínimo necessário à finalidade e ao risco | registrar fonte/provedor e prazo real |
| Foto/evidência | arquivo enviado, MIME, path e estado de moderação | documentar visualmente problema relatado | finalidade específica do relato; análise adicional quando houver terceiros ou dados sensíveis | operação/admin restrito | conforme política de evidências e retenção | privado por padrão; moderação obrigatória |
| Direitos do titular | identidade operacional necessária à verificação, solicitação, resposta e logs | atender acesso, correção, exclusão, anonimização, oposição e demais direitos aplicáveis | cumprimento de obrigação legal/regulatória e exercício regular de direitos | responsável LGPD/admin autorizado | pelo período necessário à comprovação do atendimento | minimizar prova de identidade |
| Auditoria administrativa | usuário responsável, ação, entidade, timestamps e metadata mínima | segurança, responsabilização e rastreabilidade administrativa | legítimo interesse, prevenção a fraude e exercício regular de direitos | SUPER_ADMIN/admin autorizado | política de retenção específica | metadata não deve conter conteúdo sensível bruto |

## Teste de legítimo interesse

Sempre que o projeto se apoiar em legítimo interesse, a operação deve registrar, no nível adequado ao risco:

1. finalidade legítima e concreta;
2. necessidade do tratamento;
3. expectativa razoável do titular;
4. impacto potencial sobre direitos e liberdades;
5. salvaguardas de minimização, transparência, acesso e oposição quando cabível;
6. conclusão do balanceamento.

Legítimo interesse não deve ser usado como justificativa genérica para finalidade eleitoral, perfilamento político ou tratamento de dado sensível fora das hipóteses legais específicas.

## Crianças e adolescentes

O serviço não é direcionado especificamente a crianças, mas pode receber acesso incidental de menores. A política interna `P0E_MENORES_ECA_DIGITAL.md` define o bloqueio de expansão deliberada ao público infantojuvenil até decisão formal de estratégia etária, revisão jurídica, implementação técnica e testes.

Até essa decisão, qualquer identificação de criança/adolescente em conteúdo livre ou evidência deve receber revisão reforçada, minimização e acesso restrito.

## Dados sensíveis e dados de terceiros

O protocolo `P0E_DADOS_SENSIVEIS_INCIDENTAIS.md` aplica-se a conteúdo sensível recebido espontaneamente em texto ou foto. Esses dados:

- não devem alimentar analytics ou estratégia em formato bruto;
- não devem ser usados para classificação política/eleitoral;
- devem ser anonimizados, ocultados ou excluídos quando desnecessários;
- exigem justificativa específica quando a conservação for necessária.

## Princípios operacionais

1. **Minimização:** coletar somente o necessário para a finalidade cívica declarada.
2. **Finalidade:** não reutilizar dados de demandas para campanha eleitoral.
3. **Segregação:** base cívica e eventual base eleitoral devem ter armazenamento, credenciais, permissões e governança distintos.
4. **Transparência:** informar finalidade, compartilhamentos relevantes, retenção e direitos.
5. **Segurança:** acesso administrativo autenticado, logs e princípio do menor privilégio.
6. **Não discriminação:** não inferir atributos sensíveis para priorização individual ou persuasão.
7. **Necessidade:** revisar periodicamente obrigatoriedade de campos e granularidade territorial.
8. **Melhor interesse:** aplicar proteção reforçada quando houver criança ou adolescente.

## Dados proibidos para segmentação política

O projeto não deve criar ou manter pontuação individual de intenção de voto, apoio político, persuadibilidade ou afinidade eleitoral a partir de demandas cívicas. Também não deve inferir atributos sensíveis para comunicação eleitoral.

## Compartilhamentos e operadores

Manter relação atualizada de provedores de hospedagem, banco, backups, observabilidade, e-mail e demais operadores, incluindo finalidade, categoria de dado, localização de tratamento e mecanismos aplicáveis a transferências internacionais.

## Revisão

Revisar este inventário sempre que houver novo campo, integração, fonte de dados, finalidade, fornecedor, mudança relevante de arquitetura, novo público-alvo ou alteração regulatória.
