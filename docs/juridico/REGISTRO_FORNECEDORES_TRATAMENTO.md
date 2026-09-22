# Registro operacional de fornecedores e tratamento

Versão: 2026-09-P0

## Objetivo

Documentar fornecedores que possam processar, armazenar, transmitir, proteger ou receber dados vinculados ao FISCALIZE, bem como os pontos que precisam ser confirmados antes de abertura pública ampla.

## Regra

Nenhum fornecedor deve receber mais dados do que o necessário para sua função. Mudanças de infraestrutura devem ser refletidas neste registro e na Política de Privacidade quando alterarem materialmente o tratamento.

## Matriz operacional

| Fornecedor / componente | Função | Dados potencialmente envolvidos | Papel esperado | Confirmação pendente antes do go-live |
|---|---|---|---|---|
| Railway (hospedagem de produção desde 2026-09; substituiu a Vercel) | hospedagem do container da aplicação, entrega HTTP e logs | requisições HTTP, logs técnicos e conteúdo processado pela aplicação | operador ou agente independente conforme serviço contratado | confirmar região do serviço, retenção de logs, contrato/DPA e variáveis reais; desativar ou excluir o projeto legado na Vercel e seus logs |
| armazenamento persistente da aplicação | banco cívico | contas, demandas, contatos, histórico e metadados | infraestrutura sob instruções do controlador | confirmar tecnologia efetiva de produção, região, backup, criptografia e acesso |
| armazenamento de evidências | arquivos de foto | imagens enviadas por cidadãos e metadados mínimos | infraestrutura sob instruções do controlador | confirmar diretório/storage real, controle de acesso, retenção e descarte |
| serviço de backup externo | continuidade e recuperação | cópia do banco e eventualmente evidências | operador | confirmar destino, criptografia, acesso e rotação real em até 35 dias ou prazo documentado |
| provedores de fontes públicas | inteligência cívica | dados públicos oficiais | fonte externa; sem envio deliberado de dados pessoais cívicos | manter segregação e não enviar base cívica a APIs externas |

## Vedações

É vedado utilizar ferramentas de marketing, CRM político, enriquecimento de perfis, publicidade comportamental ou listas eleitorais com dados derivados das demandas cívicas.

Também é vedado transmitir descrições livres, contatos, fotografias ou identificadores de cidadãos a ferramentas externas de IA sem base jurídica, necessidade documentada e revisão específica.

## Transferência internacional

Caso o fornecedor processe ou armazene dados fora do Brasil, essa circunstância deve ser identificada e avaliada conforme a LGPD e regulamentação aplicável. A localização efetiva e os mecanismos contratuais precisam ser confirmados no ambiente de produção, não presumidos a partir da documentação de desenvolvimento.

## Evidência de revisão

Antes de retirar o PR jurídico de draft, registrar no checklist de go-live:

- projeto/provedor efetivamente utilizado;
- região e local de armazenamento conhecidos;
- política de logs e retenção;
- mecanismo de backup e rotação;
- controles de acesso administrativos;
- contrato ou termos aplicáveis revisados;
- canal para incidentes e suporte do fornecedor.
