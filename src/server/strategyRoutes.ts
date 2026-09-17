import type { Express } from "express";
import { civicAggregatePolicy, getCivicTerritorialAggregate } from './civicAggregate.js';

export const strategy2028 = {
  horizonte: "2026–2028",
  titulo: "Núcleo de inteligência territorial e acompanhamento público",
  descricao: "Organize dados territoriais, orçamento, obras, contratos, serviços públicos, séries históricas e qualidade das fontes em um único quadro de análise. A camada permanece agregada, auditável e separada de qualquer base operacional de campanha.",
  fases: [
    {
      periodo: "2026",
      titulo: "Base factual e histórico",
      objetivo: "Consolidar fontes oficiais, qualidade territorial, séries históricas e metodologia auditável para Manaus.",
      entregas: ["Catálogo de CNPJs e fontes", "Séries históricas por território", "Qualidade e cobertura dos dados", "Relatório mensal de mudanças observadas"],
    },
    {
      periodo: "2027",
      titulo: "Cruzamentos de execução pública",
      objetivo: "Relacionar orçamento, contratos, obras e equipamentos públicos sem criar ranking político ou perfil individual.",
      entregas: ["Motor fiscal", "PNCP multi-CNPJ", "CNES e educação normalizados", "Cruzamentos financeiros auditáveis"],
    },
    {
      periodo: "2028",
      titulo: "Observatório consolidado",
      objetivo: "Manter acompanhamento contínuo, comparações históricas e documentação verificável sobre a execução pública em Manaus.",
      entregas: ["Séries anuais consolidadas", "Painel de mudanças", "Dossiês temáticos", "Monitoramento de qualidade e atualização das fontes"],
    },
  ],
  indicadores: [
    { label: "Territórios com dados classificados", meta: "Cobertura territorial" },
    { label: "Fontes públicas acompanhadas", meta: "Cobertura de fontes" },
    { label: "Indicadores fiscais consolidados", meta: "Execução orçamentária" },
    { label: "Obras e contratos relacionados", meta: "Execução pública" },
    { label: "Séries históricas disponíveis", meta: "Capacidade de comparação" },
    { label: "Registros com metodologia e origem", meta: "Auditabilidade" },
  ],
  cicloSemanal: [
    "Atualizar fontes e registrar o estado de cada coleta.",
    "Revisar registros sem classificação territorial e divergências entre fontes.",
    "Comparar mudanças relevantes com o período anterior.",
    "Validar cruzamentos fiscais, contratuais e territoriais.",
    "Documentar metodologia, limitações e evidências observadas.",
  ],
  guardrails: [
    "Separar dados cívicos públicos de qualquer base operacional eleitoral.",
    "Não armazenar ou inferir preferência política de indivíduos.",
    "Não usar atributos pessoais ou sensíveis para direcionamento político.",
    "Manter trilha de auditoria e metodologia para indicadores derivados.",
    "Trabalhar com métricas territoriais agregadas, verificáveis e proporcionais quando houver denominador confiável.",
  ],
};

export function setupStrategyRoutes(app: Express) {
  app.get("/api/admin/strategy/2028", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.json(strategy2028);
  });

  app.get('/api/admin/strategy/civic-aggregate', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.json({ policy: civicAggregatePolicy(), rows: getCivicTerritorialAggregate() });
  });
}
