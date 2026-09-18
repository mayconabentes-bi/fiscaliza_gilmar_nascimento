import { useEffect, useRef, useState } from "react";
import { Activity, BarChart3, CheckCircle2, Database, Flag, Layers3, ShieldCheck, Target } from "lucide-react";
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
type MobileView = "resumo" | "dados" | "analises" | "plano";
type SignalView = "status" | "categoria";

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
  const [mobileView, setMobileView] = useState<MobileView>("resumo");
  const [signalView, setSignalView] = useState<SignalView>("status");
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
  const mobileSectionClass = (view: MobileView) => mobileView === view ? "block" : "hidden sm:block";
  const mobileViews: Array<{ key: MobileView; label: string }> = [
    { key: "resumo", label: "Resumo" },
    { key: "dados", label: "Dados" },
    { key: "analises", label: "Análises" },
    { key: "plano", label: "Plano" },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      <section className="rounded-2xl border border-[#e5e9e6] bg-white p-4 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#157a55] sm:text-sm"><Flag className="h-4 w-4" /> Estratégia</div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-[#101513] sm:mt-3 sm:text-3xl">{data.titulo}</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#69736d] sm:hidden">Quadro privado para acompanhar sinais, dados públicos, análises e plano de evolução.</p>
            <p className="mt-3 hidden max-w-4xl text-[#69736d] sm:block">{data.descricao}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#dbe8e0] bg-[#eef7f2] px-3 py-1.5 text-[11px] font-bold text-[#157a55] sm:text-xs">Horizonte {data.horizonte}</span>
        </div>
      </section>

      <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-[#dbe8e0] bg-[#f3f8f5] p-1.5 shadow-sm sm:hidden" role="tablist" aria-label="Visões da Estratégia">
        {mobileViews.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={mobileView === item.key}
            onClick={() => setMobileView(item.key)}
            className={`min-h-11 rounded-xl px-2 py-2 text-xs font-extrabold transition ${mobileView === item.key ? "bg-white text-[#157a55] shadow-sm" : "text-[#69736d]"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={mobileSectionClass("resumo")} data-strategy-mobile-view="resumo">
        <section className="rounded-2xl border border-[#dbe8e0] bg-[#f7fbf9] p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-2">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-[#157a55]" />
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-[#157a55]">Sinais operacionais</p>
              <p className="mt-1 text-sm text-[#69736d]">Resumo agregado das demandas registradas no FISCALIZE.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Total", demandMetrics?.resumo.total ?? "—"],
              ["Pendentes", demandMetrics?.resumo.pendentes ?? "—"],
              ["Concluídas", demandMetrics?.resumo.concluidas ?? "—"],
              ["Críticas", demandMetrics?.resumo.criticas ?? "—"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[#e5e9e6] bg-white p-3.5 sm:p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#69736d] sm:text-xs">{label}</p>
                <p className="mt-1.5 text-2xl font-extrabold text-[#101513]">{value}</p>
              </div>
            ))}
          </div>

          {demandMetrics && (
            <>
              <div className="mt-4 flex gap-1 rounded-xl bg-[#edf4f0] p-1 sm:hidden" role="tablist" aria-label="Detalhamento dos sinais operacionais">
                <button type="button" role="tab" aria-selected={signalView === "status"} onClick={() => setSignalView("status")} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-extrabold ${signalView === "status" ? "bg-white text-[#157a55] shadow-sm" : "text-[#69736d]"}`}>Andamento</button>
                <button type="button" role="tab" aria-selected={signalView === "categoria"} onClick={() => setSignalView("categoria")} className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-extrabold ${signalView === "categoria" ? "bg-white text-[#157a55] shadow-sm" : "text-[#69736d]"}`}>Categorias</button>
              </div>

              <div className="mt-3 sm:hidden">
                {signalView === "status" ? (
                  <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                    <div className="space-y-2">{demandMetrics.porStatus.map((item) => <div key={item.status} className="flex min-h-10 items-center justify-between gap-3 text-sm"><span className="text-[#69736d]">{demandStatusLabel(item.status)}</span><strong className="text-[#101513]">{item.total}</strong></div>)}</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                    <div className="space-y-2">{demandMetrics.porCategoria.slice(0, 8).map((item) => <div key={item.categoria} className="flex min-h-10 items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-[#69736d]">{item.categoria}</span><strong className="shrink-0 text-[#101513]">{item.total}</strong></div>)}</div>
                  </div>
                )}
              </div>

              <div className="mt-4 hidden gap-4 sm:grid md:grid-cols-2">
                <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                  <p className="text-sm font-extrabold text-[#101513]">Por andamento</p>
                  <div className="mt-3 space-y-2">{demandMetrics.porStatus.map((item) => <div key={item.status} className="flex items-center justify-between gap-3 text-sm"><span className="text-[#69736d]">{demandStatusLabel(item.status)}</span><strong className="text-[#101513]">{item.total}</strong></div>)}</div>
                </div>
                <div className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                  <p className="text-sm font-extrabold text-[#101513]">Por categoria</p>
                  <div className="mt-3 space-y-2">{demandMetrics.porCategoria.slice(0, 8).map((item) => <div key={item.categoria} className="flex items-center justify-between gap-3 text-sm"><span className="text-[#69736d]">{item.categoria}</span><strong className="text-[#101513]">{item.total}</strong></div>)}</div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <div className={mobileSectionClass("dados")} data-strategy-mobile-view="dados">
        <section className="rounded-2xl border border-[#dbe8e0] bg-[#f7fbf9] p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#157a55]"><Database className="h-4 w-4" /> Base factual territorial</div>
              <h2 className="mt-2 text-lg font-extrabold text-[#101513] sm:text-xl">Dados públicos integrados ao acompanhamento 2026–2028</h2>
              <p className="mt-2 hidden max-w-4xl text-sm text-[#69736d] sm:block">Leitura descritiva de território, orçamento, obras, serviços e fontes públicas, com metodologia e origem verificáveis.</p>
            </div>
            {works?.generatedAt && <span className="text-xs font-semibold text-[#69736d]">Consulta: {new Date(works.generatedAt).toLocaleString("pt-BR")}</span>}
          </div>

          <div className="mt-4 sm:mt-5"><IntelligenceRefreshPanel onRefreshed={() => loadIntelligence().catch(() => undefined)} /></div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 xl:grid-cols-4">
            {[
              ["Obras municipais", municipalTotal ?? "—", works ? availabilityLabel(works.municipal.availability) : "Carregando em segundo plano"],
              ["Projetos ObrasGov", federalTotal ?? "—", works ? availabilityLabel(works.federal.availability) : "Carregando em segundo plano"],
              ["Cobertura ObrasGov", typeof works?.federal.quality?.coverage === "number" ? `${Math.round(works.federal.quality.coverage * 100)}%` : "—", "Registros classificados"],
              ["Fontes monitoradas", health?.live?.length ?? "—", "Estado da Intelligence API"],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-xl border border-[#e5e9e6] bg-white p-3.5 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#69736d] sm:text-xs">{label}</p>
                <p className="mt-1.5 text-xl font-extrabold text-[#101513] sm:text-2xl">{value}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#69736d] sm:text-sm">{hint}</p>
              </div>
            ))}
          </div>

          {health?.live?.length ? (
            <>
              <details className="mt-4 rounded-xl border border-[#e5e9e6] bg-white sm:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-[#101513]">
                  <span>Estado das fontes</span><span className="text-xs font-semibold text-[#69736d]">{health.live.length} fontes</span>
                </summary>
                <div className="border-t border-[#eef0ee] px-4 py-2">
                  {health.live.map((source) => (
                    <div key={source.source} className="flex min-h-12 items-center justify-between gap-3 border-b border-[#f0f2f1] py-2 last:border-0">
                      <span className="min-w-0 truncate text-sm font-semibold text-[#37413c]">{sourceLabel(source.source)}</span>
                      <span className="shrink-0 text-xs font-bold text-[#69736d]">{availabilityLabel(source.availability)}</span>
                    </div>
                  ))}
                </div>
              </details>
              <div className="mt-5 hidden grid-cols-1 gap-3 sm:grid md:grid-cols-2 xl:grid-cols-4">
                {health.live.map((source) => (
                  <div key={source.source} className="rounded-xl border border-[#e5e9e6] bg-white p-4">
                    <p className="font-bold text-[#101513]">{sourceLabel(source.source)}</p>
                    <p className="mt-1 text-sm text-[#69736d]">{availabilityLabel(source.availability)}</p>
                    <p className="mt-2 text-xs text-[#8a928e]">Registros: {source.recordsReturned ?? source.quality?.total ?? "—"}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <div className={`${mobileSectionClass("analises")} space-y-5 sm:space-y-8`} data-strategy-mobile-view="analises">
        <AdvancedIntelligencePanel />
        <IntelligenceInsightsPanel />
      </div>

      <div className={`${mobileSectionClass("plano")} space-y-5 sm:space-y-8`} data-strategy-mobile-view="plano">
        <section>
          <div className="mb-3 flex items-center gap-2 sm:mb-5"><Layers3 className="h-5 w-5 text-[#157a55]" /><h2 className="text-lg font-extrabold text-[#101513]">Indicadores de evolução</h2></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.indicadores.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#e5e9e6] bg-white p-4 shadow-sm sm:p-5">
                <Target className="mb-2 h-5 w-5 text-[#157a55] sm:mb-3" />
                <p className="text-sm font-bold leading-5 text-[#101513]">{item.label}</p>
                <p className="mt-1 text-xs leading-4 text-[#69736d] sm:text-sm">{item.meta}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5e9e6] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 sm:mb-5"><BarChart3 className="h-5 w-5 text-[#157a55]" /><h2 className="text-xl font-extrabold text-[#101513]">Roadmap de inteligência</h2></div>

          <div className="space-y-3 sm:hidden">
            {data.fases.map((fase, index) => (
              <details key={fase.periodo} open={index === 0} className="rounded-xl border border-[#e5e9e6]">
                <summary className="cursor-pointer list-none px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#157a55]">{fase.periodo}</p>
                  <h3 className="mt-1 text-base font-extrabold text-[#101513]">{fase.titulo}</h3>
                </summary>
                <div className="border-t border-[#eef0ee] px-4 py-4">
                  <p className="text-sm leading-5 text-[#69736d]">{fase.objetivo}</p>
                  <div className="mt-3 space-y-2">
                    {fase.entregas.map((entrega) => <div key={entrega} className="flex items-start gap-2 text-sm text-[#56615b]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#157a55]" /><span>{entrega}</span></div>)}
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="hidden space-y-5 sm:block">
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
        </section>

        <section className="space-y-3 sm:hidden">
          <details className="rounded-2xl border border-[#e5e9e6] bg-white shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 py-3 font-extrabold text-[#101513]">
              <span>Ciclo semanal</span><Activity className="h-5 w-5 text-[#157a55]" />
            </summary>
            <ol className="border-t border-[#eef0ee] px-5 py-4 list-inside list-decimal space-y-3 text-sm text-[#69736d]">{data.cicloSemanal.map((item) => <li key={item}>{item}</li>)}</ol>
          </details>
          <details className="rounded-2xl bg-[#101513] text-white shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 py-3 font-extrabold">
              <span>Guardrails</span><ShieldCheck className="h-5 w-5 text-emerald-400" />
            </summary>
            <ul className="border-t border-slate-700 px-5 py-4 list-inside list-disc space-y-3 text-sm text-slate-300">{data.guardrails.map((item) => <li key={item}>{item}</li>)}</ul>
          </details>
        </section>

        <section className="hidden grid-cols-1 gap-6 sm:grid xl:grid-cols-2">
          <div className="rounded-2xl border border-[#e5e9e6] bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold text-[#101513]">Ciclo semanal</h2><ol className="mt-4 list-inside list-decimal space-y-3 text-sm text-[#69736d]">{data.cicloSemanal.map((item) => <li key={item}>{item}</li>)}</ol></div>
          <div className="rounded-2xl bg-[#101513] p-6 text-white shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400" /><h2 className="text-lg font-extrabold">Guardrails</h2></div><ul className="mt-4 list-inside list-disc space-y-3 text-sm text-slate-300">{data.guardrails.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </section>
      </div>
    </div>
  );
}
