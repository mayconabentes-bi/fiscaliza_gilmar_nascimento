import { Request, Response, NextFunction } from 'express';
import { ContextStore } from './ContextStore.js';
import { MunicipalityContext } from '../../domain/multimunicipio/MunicipalityContext.js';
import { logger } from '../observabilidade/StructuredLogger.js';

export const municipalityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Tenta extrair o municipality_id de várias fontes
  const municipalityId = 
    req.headers['x-municipality-id'] as string || 
    (req as any).user?.municipality ||
    req.query.municipality_id as string;

  // Rotas que exigem contexto explícito (ex: agregações, dashboards)
  const requiresExplicitContext = (req.path.includes('/analytics/') || req.path.includes('/dashboard/')) && !req.path.includes('/temas-emergentes');

  if (requiresExplicitContext && !municipalityId) {
    logger.warn({
      module: 'MunicipalityMiddleware',
      correlation_id: (req as any).id || 'unknown',
      event_type: 'MISSING_MUNICIPALITY_CONTEXT',
      message: `Access denied to ${req.path}: Missing municipality_id context.`,
      metadata: { path: req.path, method: req.method }
    });
    return res.status(400).json({ error: 'Municipality context is required for this operation.' });
  }

  if (municipalityId) {
    // Validação básica de formato (pode ser expandida para verificar existência no DB)
    if (!/^[a-zA-Z0-9-]+$/.test(municipalityId)) {
       return res.status(400).json({ error: 'Invalid municipality_id format.' });
    }

    // Cria o contexto
    const context = new MunicipalityContext(
      municipalityId,
      'America/Sao_Paulo', // Default timezone, poderia vir de config
      'MUNICIPAL'
    );

    // Roda o restante da request dentro do AsyncLocalStorage
    ContextStore.run(context, () => {
      next();
    });
  } else {
    next();
  }
};
