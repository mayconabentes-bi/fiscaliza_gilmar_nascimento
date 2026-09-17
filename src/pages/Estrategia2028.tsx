import { useEffect, useRef, useState } from "react";
import { BarChart3, CheckCircle2, Database, Flag, ShieldCheck, Target } from "lucide-react";
import IntelligenceRefreshPanel from "../components/IntelligenceRefreshPanel";
import IntelligenceInsightsPanel from "../components/IntelligenceInsightsPanel";
import AdvancedIntelligencePanel from "../components/AdvancedIntelligencePanel";
import { fetchWithTimeout } from "../lib/request";

type StrategyData = {
  horizonte: string;
  titulo: string;
  descricao: string;
  fases: Array<{ periodo: string; titulo: string; objetivo: string; entregas: string[] }>;
  indicadores: Array<{ label: string; meta: string }>;
  cicloSemanal: string[];
  guardrails: string[];
};

type SourceEnvelope = {
  source: string;
  availability: string;
  quality?: { total?: number; classified?: number; coverage?: number; truncated?: boolean };
  recordsReturned?: number;
  error?: string | null;
  provenance?: { sourceUrl?: string; fetchedAt?: string; fromCache?: boolean };
};

type WorksData = {
  generatedAt: string;
  municipal: SourceEnvelope & { data?: unknown[] };
  federal: SourceEnvelope & { data?: unknown[] };
};

type HealthData = {
  generatedAt: string;
  live: SourceEnvelope[];
};

type DemandMetrics = {
  resumo: { total: number; concluidas: number; pendentes: number; criticas: number };
  porStatus: Array<{ status: string; total: number }>;
  porMunicipio: Array<{ municipio: string; total: number }>;
  porCategoria: Array<{ categoria: string; total: number }>;
};

type LoadError = "forbidden" | "unavailable" | null;

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    geomanaus_bairros: "GeoManaus / Bairros",
    seminf_obras: "SEMINF / Obras municipais",
    geomanaus_saude: "SEMSA / Saúde",
    geomanaus_escolas: "SEMED / Escolas",
    cmm_sapl: "CMM / SAPL",
    obrasgov: "ObrasGov",
    tce_am: "TCE-AM",
    transparencia_manaus: "Transparência Manaus",
    ibge_populacao: "IBGE / População",
    siconfi_dca: "Tesouro / SICONFI",
    pncp_contratos: "PNCP / Contratos",
    cnes_datasus_catalogo: "DATASUS / CNES",
    inep_censo_escolar: "INEP / Censo Escolar",
  };
  return labels[source] || source;
}

function availabilityLabel(value: string) {
  const labels: Record<string, string> = {
    available: "Disponível",
    degraded: "Disponível com ressalvas",
    unavailable: "Indisponível",
    not_configured: "Não configurado",
    unknown: "Sem atualização",
  };
  return labels[value] || value;
}

function demandStatusLabel(value: string) {
  const labels: Record<string, string> = {
    RECEBIDA: "Recebida",
    EM_TRIAGEM: "Em triagem",
    ENCAMINHADA: "Encaminhada",
    EM_ANALISE: "Em análise",
    EM_EXECUCAO: "Em execução",
    CONCLUIDA: "Concluída",
    INDEFERIDA: "Indeferida",
  };
  return labels[value] || value.replaceAll("_", " ");
}

function totalFrom(source?: SourceEnvelope & { data?: unknown[] }) {
  if (!source) return null;
  if (typeof source.quality?.total === "number") return source.quality.total;
  if (typeof source.recordsReturned === "number") return source.recordsReturned;
  if (Array.isArray(source.data)) return source.data.length;
  return null;
}

export default function Estrategia2028() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [works, setWorks] = useState<WorksData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [demandMetrics, setDemandMetrics] = useState<DemandMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const loadDemandMetrics = async (signal?: AbortSignal) => {
    try {
      const response = await fetchWithTimeout(
        "/api/demandas/metricas",
        { credentials: "same-origin", cache: "no-store", signal },
        5000
      );
      if (response.ok && !signal?.aborted) setDemandMetrics(await response.json());
    } catch (error: any) {
      if (signal?.aborted || error?.name === "AbortError") return;
    }
  };

  const loadIntelligence = async (signal?: AbortSignal) => {
    try {
      const worksResponse = await fetchWithTimeout(
        "/api/intelligence/works",
        { credentials: "same-origin", cache: "no-store", signal },
        8000
      );
      if (worksResponse.ok && !signal?.aborted) setWorks(await worksResponse.json());
    } catch (error: any) {
      if (signal?.aborted || error?.name === "AbortError") return;
    }

    try {
      const healthResponse = await fetchWithTimeout(
        "/api/intelligence/sources/health",
        { credentials: "same-origin", cache: "no-store", signal },
        8000
      );
      if (healthResponse.ok && !signal?.aborted) setHealth(await healthResponse.json());
    } catch (error: any) {
      if (signal?.aborted || error?.name === "AbortError") return;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const strategyResponse = await fetchWithTimeout(
          "/api/admin/strategy/2028",
          { credentials: "same-origin", cache: "no-store", signal: controller.signal },
          8000
        );
        if (strategyResponse.status === 401 || strategyResponse.status === 403) {
          setLoadError("forbidden");
          return;
        }
        if (strategyResponse.status === 503 || !strategyResponse.ok) {
          setLoadError("unavailable");
          return;
        }
        const strategy = await strategyResponse.json();
        if (controller.signal.aborted) return;
        setData(strategy);
        setLoading(false);
        await loadDemandMetrics(controller.signal);
        await loadIntelligence(controller.signal);
      } catch (error: any) {
        if (controller.signal.aborted || error?.name === "AbortError") return;
        setLoadError("unavailable");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  if (loading) return <div className="py-20 text-center text-sm font-semibold text-[#69736d]">Carregando núcleo de inteligência...</div>;

  if (loadError === "forbidden") {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e5e9e6] bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[#8a928e]" />
        <h1 className="text-2xl font-extrabold text-[#101513]">Acesso restrito</h1>
        <p className="mt-3 text-[#69736d]">Sua sessão não tem permissão para acessar este núcleo privado.</p>
      </div>
    );
  }

  if (loadError === "unavailable" || !data) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#e5e9e6] bg-white p-8 text-center shadow-sm">
        <Database className="mx-auto mb-4 h-12 w-12 text-[#8a928e]" />
        <h1 className="text-2xl font-extrabold text-[#101513]">Módulo temporariamente indisponível</h1>
        <p className="mt-3 text-[#69736d]">Seu acesso está autenticado, mas este núcleo ainda está em migração para a persistência de produção.</p>
      </div>
    );
  }

  const municipalTotal = totalFrom(works?.municipal);
  const federalTotal = totalFrom(works?.federal);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#e5e9e6] bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#157a55]"><Flag className="h-4 w-4" /> Núcleo de Inteligência Territorial</div>
            <h1 className="mt-3 text-3xl font-extrabold text-[#101513]">{data.titulo}</h1>
            <p className="mt-3 max-w-4xl text-[#69736d]">{data.descricao}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#dbe8e0] bg-[#eef7f2] px-3 py-1 text-xs font-bold text-[#157a55]">Horizonte {data.horizonte}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dbe8e0] bg-[#f7fbf9] p-6 shadow-sm">
        <div className="flex items-start gap-2">
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-[#157a55]" />
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-[#157a55]">Sinais operacionais das demandas registradas</p>
            <p className="mt-1 text-sm text-[#69736d]">Resumo descritivo do canal FISCALIZE, alimentado diretamente pela persistência de produção.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Total</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{demandMetrics?.resumo.total ?? "—"}</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Pendentes</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{demandMetrics?.resumo.pendentes ?? "—"}</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Concluídas</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{demandMetrics?.resumo.concluidas ?? "—"}</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Críticas</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{demandMetrics?.resumo.criticas ?? "—"}</p></div>
        </div>

        {demandMetrics && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
              <p className="text-sm font-extrabold text-[#101513]">Por andamento</p>
              <div className="mt-3 space-y-2">
                {demandMetrics.porStatus.map((item) => <div key={item.status} className="flex items-center justify-between gap-3 text-sm"><span className="text-[#69736d]">{demandStatusLabel(item.status)}</span><strong className="text-[#101513]">{item.total}</strong></div>)}
              </div>
            </div>
            <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
              <p className="text-sm font-extrabold text-[#101513]">Por categoria</p>
              <div className="mt-3 space-y-2">
                {demandMetrics.porCategoria.slice(0, 8).map((item) => <div key={item.categoria} className="flex items-center justify-between gap-3 text-sm"><span className="text-[#69736d]">{item.categoria}</span><strong className="text-[#101513]">{item.total}</strong></div>)}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dbe8e0] bg-[#f7fbf9] p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#157a55]"><Database className="h-4 w-4" /> Base factual territorial</div>
            <h2 className="mt-2 text-xl font-extrabold text-[#101513]">Dados públicos integrados ao acompanhamento 2026–2028</h2>
            <p className="mt-2 max-w-4xl text-sm text-[#69736d]">Leitura descritiva de território, orçamento, obras, serviços e fontes públicas, com metodologia e origem verificáveis.</p>
          </div>
          {works?.generatedAt && <span className="text-xs font-semibold text-[#69736d]">Consulta: {new Date(works.generatedAt).toLocaleString("pt-BR")}</span>}
        </div>

        <div className="mt-5"><IntelligenceRefreshPanel onRefreshed={() => loadIntelligence().catch(() => undefined)} /></div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Obras municipais</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{municipalTotal ?? "—"}</p><p className="mt-1 text-sm text-[#69736d]">{works ? availabilityLabel(works.municipal.availability) : "Carregando em segundo plano"}</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Projetos ObrasGov</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{federalTotal ?? "—"}</p><p className="mt-1 text-sm text-[#69736d]">{works ? availabilityLabel(works.federal.availability) : "Carregando em segundo plano"}</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Cobertura ObrasGov</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{typeof works?.federal.quality?.coverage === "number" ? `${Math.round(works.federal.quality.coverage * 100)}%` : "—"}</p><p className="mt-1 text-sm text-[#69736d]">Registros classificados no recorte consultado</p></div>
          <div className="rounded-xl border border-[#e5e9e6] bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-[#69736d]">Fontes monitoradas</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{health?.live?.length ?? "—"}</p><p className="mt-1 text-sm text-[#69736d]">Estado verificado pela Intelligence API</p></div>
        </div>

        {health?.live?.length ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {health.live.map((source) => (
              <div key={source.source} className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                <p className="font-bold text-[#101513]">{sourceLabel(source.source)}</p>
                <p className="mt-1 text-sm text-[#69736d]">{availabilityLabel(source.availability)}</p>
                <p className="mt-2 text-xs text-[#8a928e]">Registros: {source.recordsReturned ?? source.quality?.total ?? "—"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <AdvancedIntelligencePanel />
      <IntelligenceInsightsPanel />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.indicadores.map((item) => (
          <div key={item.label} className="rounded-xl border border-[#e5e9e6] bg-white p-5 shadow-sm">
            <Target className="mb-3 h-5 w-5 text-[#157a55]" />
            <p className="font-bold text-[#101513]">{item.label}</p>
            <p className="mt-1 text-sm text-[#69736d]">{item.meta}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e9e6] bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#157a55]" /><h2 className="text-xl font-extrabold text-[#101513]">Roadmap de inteligência</h2></div>
          <div className="space-y-5">
            {data.fases.map((fase) => (
              <div key={fase.periodo} className="rounded-xl border border-[#e5e9e6] p-5">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#157a55]">{fase.periodo}</p>
                <h3 className="mt-1 text-lg font-extrabold text-[#101513]">{fase.titulo}</h3>
                <p className="mt-2 text-sm text-[#69736d]">{fase.objetivo}</p>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {fase.entregas.map((entrega) => <div key={entrega} className="flex items-center gap-2 text-sm text-[#56615b]"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#157a55]" />{entrega}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#e5e9e6] bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-[#101513]">Ciclo semanal</h2><ol className="mt-4 list-inside list-decimal space-y-3 text-sm text-[#69736d]">{data.cicloSemanal.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div className="rounded-2xl bg-[#101513] p-6 text-white shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-extrabold">Guardrails</h2></div><ul className="mt-4 list-inside list-disc space-y-3 text-sm text-slate-300">{data.guardrails.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>
    </div>
  );
}
