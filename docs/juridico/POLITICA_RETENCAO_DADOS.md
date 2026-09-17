# Política operacional de retenção e descarte — FISCALIZE

Versão: 2026-09-P0-C

## Princípio

O FISCALIZE não deve manter dados pessoais por prazo indefinido apenas porque é tecnicamente possível. A retenção fica vinculada à finalidade cívica, segurança, histórico necessário, defesa de direitos e obrigações aplicáveis.

Os prazos abaixo são parâmetros operacionais internos e não afirmam que toda categoria precise ser mantida até o limite. Havendo perda de finalidade antes do prazo e inexistindo motivo legítimo de conservação, deve-se antecipar a eliminação ou anonimização.

## Prazos operacionais

| Categoria | Prazo padrão | Evento inicial | Destino após prazo | Responsável |
|---|---:|---|---|---|
| Demanda ativa | enquanto necessária | registro | revisão no encerramento | controlador/administrador |
| Contato de demanda encerrada | 180 dias | última atualização de demanda concluída/indeferida | remover contato do registro | controlador/administrador |
| Evidência fotográfica de demanda encerrada | 365 dias | última atualização de demanda concluída/indeferida | excluir arquivo e manter somente estado de moderação | controlador/administrador |
| Conta excluída/inativa | até 730 dias para resíduos técnicos necessários | encerramento/exclusão | pseudonimizar ou eliminar campos remanescentes não necessários | controlador/administrador |
| Logs de auditoria | até 1.825 dias | geração | exclusão, salvo preservação específica justificada | controlador/administrador |
| Analytics agregado | até 730 dias | data do agregado | exclusão do agregado antigo | controlador/administrador |
| Backup | conforme rotação do provedor/ambiente, preferencialmente até 35 dias | criação do backup | expiração/rotação segura | operador de infraestrutura |

## Demandas e histórico

Enquanto a demanda estiver ativa, manter os dados necessários para acompanhamento. O histórico cívico pode ser preservado por período maior desde que identificadores e contato sejam retirados quando deixarem de ser necessários.

## Contato opcional

O contato existe para permitir retorno sobre o caso. Não pode ser convertido em lista de divulgação, marketing ou campanha. O descarte operacional padrão ocorre 180 dias após a última atualização de uma demanda concluída ou indeferida.

## Evidências fotográficas

Toda foto entra com status `PENDENTE` e permanece privada. Não existe publicação automática. A moderação pode classificar como `APROVADA_PRIVADA`, `REJEITADA` ou `REQUER_ANONIMIZACAO`.

Fotos rejeitadas são removidas do armazenamento operacional. Fotos de demandas encerradas são removidas após 365 dias por padrão, salvo preservação específica e documentada por necessidade jurídica ou técnica.

## Contas de usuário

Pedidos de exclusão devem desativar o acesso e pseudonimizar dados cadastrais. Resíduos técnicos estritamente necessários podem permanecer temporariamente para segurança, integridade e defesa de direitos, com limite operacional de até 730 dias quando aplicável.

## Analytics agregado

A camada móvel guarda contagens agregadas por dia, evento, origem e ação. Não deve conter identificadores individuais. O prazo operacional padrão é de 730 dias.

## Logs e auditoria

Logs de auditoria podem ser preservados por até cinco anos para investigação, rastreabilidade e defesa de direitos, salvo obrigação ou necessidade específica de preservação. O acesso deve permanecer restrito.

## Backups

Backups não devem perpetuar indefinidamente dados já destinados à exclusão. A base ativa deve refletir a exclusão imediatamente; cópias de segurança devem expirar dentro da janela documentada pelo provedor/ambiente. O objetivo operacional é rotação de até 35 dias quando tecnicamente disponível.

## Execução técnica

A aplicação possui duas operações administrativas:

- `GET /api/admin/compliance/retention-preview`: simula quantos registros serão afetados;
- `POST /api/admin/compliance/retention-run` com `{ "confirm": true }`: executa o descarte segundo os prazos configurados.

Os parâmetros podem ser ajustados por variáveis de ambiente, mas qualquer ampliação relevante de prazo deve ser documentada e justificada.

## Exceções

Retenção além do prazo padrão só deve ocorrer quando houver motivo concreto, como obrigação legal, preservação de evidência, exercício regular de direitos, incidente de segurança ou determinação de autoridade competente. A exceção deve ser registrada em trilha de auditoria quando operacionalmente aplicável.
