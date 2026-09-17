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
expect(protocol.includes('Descrição, contato, foto e observações internas não são exibidos aqui.'), 'A salvaguarda de privacidade pública deve permanecer explícita.');
expect(protocol.includes('historico.map') && protocol.includes('status_novo'), 'A timeline deve continuar baseada no histórico real retornado pela API.');
expect(!/garantia|garantido|prazo de \d+|resolve em|solução em/i.test(protocol), 'A interface não deve prometer solução ou prazo não comprovado.');
expect(protocol.includes('min-h-14') && protocol.includes('text-base'), 'A consulta deve preservar ergonomia mobile nos controles críticos.');

console.log('Protocol follow-up contract OK: status real, próximo passo, privacidade, compartilhamento opcional e ausência de promessa artificial.');
