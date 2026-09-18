import fs from 'node:fs';

const protocol = fs.readFileSync('src/pages/ConsultaProtocolo.tsx', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(protocol.includes('/api/demandas/protocolo/'), 'A consulta deve preservar o endpoint público existente.');
expect(protocol.includes('statusGuidance') && protocol.includes('RECEBIDA') && protocol.includes('CONCLUIDA') && protocol.includes('INDEFERIDA'), 'A orientação deve derivar dos estados reais do backend.');
expect(protocol.includes('Última atualização') && protocol.includes('updated_at'), 'A interface deve expor a última atualização sem inventar prazo.');
expect(protocol.includes('não exibe prazo automático de solução'), 'A interface deve declarar que não existe prazo automático de solução.');
expect(protocol.includes('navigator.clipboard') && protocol.includes('navigator.share'), 'A jornada deve permitir copiar e compartilhar o protocolo de forma opcional.');
expect(protocol.includes('aria-live="polite"'), 'O feedback das ações deve ser acessível.');
expect(protocol.includes('Consulta pública protegida.') && protocol.includes('Descrição, contato, fotos, endereço detalhado e observações internas não são exibidos.'), 'A salvaguarda de privacidade pública deve permanecer explícita e incluir endereço detalhado.');
expect(protocol.includes('historico.map') && protocol.includes('status_novo') && protocol.includes('historyNewestFirst'), 'A timeline deve continuar baseada no histórico real, exibindo atualização mais recente primeiro no mobile.');
expect(!/garantia|garantido|prazo de \d+|resolve em|solução em/i.test(protocol), 'A interface não deve prometer solução ou prazo não comprovado.');
expect(protocol.includes('min-h-14') && protocol.includes('text-base'), 'A consulta deve preservar ergonomia mobile nos controles críticos.');
expect(protocol.includes('PROTOCOL_RE') && protocol.includes('if (!PROTOCOL_RE.test(normalized))'), 'Formato inválido deve ser rejeitado no cliente antes da API sem substituir a validação do backend.');
expect(protocol.includes('data-followup-search') && protocol.includes('data-followup-status') && protocol.includes('data-followup-history'), 'A arquitetura mobile deve priorizar busca, status e histórico.');
expect(protocol.indexOf('data-followup-search') < protocol.indexOf('Consulta pública protegida.'), 'A busca deve aparecer antes da explicação de privacidade no fluxo mobile.');
expect(protocol.includes('data-followup-protocol') && protocol.includes('Copiar') && protocol.includes('Compartilhar'), 'Ações opcionais devem permanecer agrupadas ao protocolo.');
expect(protocol.includes('Tentar novamente') && protocol.includes('Protocolo não encontrado'), 'Erro de consulta deve orientar nova tentativa sem expor dados adicionais.');
expect(!protocol.includes('trackPulsoEvent') && !protocol.includes('/api/mobile-events'), 'Consulta por protocolo não deve enviar o código ou seu contexto à telemetria.');

console.log('Protocol follow-up contract OK: status real, próximo passo, privacidade, compartilhamento opcional e ausência de promessa artificial.');
