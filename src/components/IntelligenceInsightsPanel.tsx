import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Database, Network } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

type Change = {
  metric: string;
  label: string;
  unit: string;
  current: number;
  previous: number | null;
  delta: number | null;
  changed: boolean | null;
  methodology: string;
  sourceKeys: string[];
  collectedAt: string;
};

type InsightsResponse = {
  generatedAt: string;
  territory: string;
  currentPeriod: string | null;
  previousPeriod: string | null;
  hasComparison: boolean;
  message: string;
  changes: Change[];
};

type ContextIndicator = { key: string; label: string; value: number | null; unit: string; methodology: string; sourceKeys: string[] };
type ContextResponse = {
  generatedAt: string;
  population: number | null;
  indicators: ContextIndicator[];
  observations: string[];
  sourceStatus: Array<{ source: string; availability: string; records: number; coverage: number; error?: string | null }>;
  methodology: string;
};

function formatNumber(value: number) { return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }

function Delta({ change }: { change: Change }) {
  if (change.delta == null) return <span className="text-xs font-semibold text-[#8a928e]">Sem comparação anterior</span>;
  if (change.delta === 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-[#69736d]"><ArrowRight className="h-3.5 w-3.5" /> sem alteração</span>;
  if (change.delta > 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-[#157a55]"><ArrowUpRight className="h-3.5 w-3.5" /> +{formatNumber(change.delta)}</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-bold text-[#9b3b3b]"><ArrowDownRight className="h-3.5 w-3.5" /> {formatNumber(change.delta)}</span>;
}

export default function IntelligenceInsightsPanel() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const load = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const historyResponse = await fetchWithTimeout(
        "/api/intelligence/insights",
        { credentials: "same-origin", cache: "no-store", signal: controller.signal },
        7000
      );
      const historyPayload = await historyResponse.json();
      if (!historyResponse.ok) throw new Error(historyPayload.error || "Não foi possível carregar os insights.");
      if (!controller.signal.aborted) setData(historyPayload);
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
      setError(err?.message || "Não foi possível carregar os insights.");
    } finally {
      if (controllerRef.current === controller && !controller.signal.aborted) setLoading(false);
    }

    if (controller.signal.aborted) return;
    try {
      const contextResponse = await fetchWithTimeout(
        "/api/intelligence/context",
        { credentials: "same-origin", cache: "no-store", signal: controller.signal },
        7000
      );
      if (contextResponse.ok && !controller.signal.aborted) setContext(await contextResponse.json());
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
    }
  };

  useEffect(() => {
    load();
    const handleRefresh = () => { load().catch(() => undefined); };
    window.addEventListener("pulso:intelligence-refreshed", handleRefresh);
    return () => {
      controllerRef.current?.abort();
      window.removeEventListener("pulso:intelligence-refreshed", handleRefresh);
    };
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6">
      {context && (
        <section className="rounded-2xl border border-[#dfe6e2] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3"><Network className="mt-0.5 h-5 w-5 text-[#157a55]" /><div><p className="text-sm font-extrabold uppercase tracking-wide text-[#157a55]">Contexto multi-fonte</p><h2 className="mt-1 text-xl font-extrabold text-[#101513]">Indicadores proporcionais e cobertura pública</h2><p className="mt-2 hidden max-w-3xl text-sm leading-6 text-[#69736d] sm:block">Cruzamento entre IBGE, SEMINF, GeoManaus, PNCP, SICONFI, ObrasGov e demais fontes monitoradas.</p><p className="mt-2 text-sm leading-5 text-[#69736d] sm:hidden">Indicadores agregados de múltiplas fontes públicas.</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 md:grid-cols-2 xl:grid-cols-4">
            {context.indicators.map((indicator) => (
              <details key={indicator.key} className="rounded-xl border border-[#e5e9e6] bg-[#fbfcfb] p-3.5 sm:p-4">
                <summary className="cursor-pointer list-none"><p className="text-sm font-bold text-[#37413c]">{indicator.label}</p><p className="mt-1.5 text-xl font-extrabold text-[#101513] sm:mt-2 sm:text-2xl">{indicator.value == null ? "—" : formatNumber(indicator.value)}</p></summary>
                <div className="mt-3 border-t border-[#eef0ee] pt-3 text-xs leading-5 text-[#69736d]"><p><strong>Metodologia:</strong> {indicator.methodology}</p><p className="mt-1"><strong>Fontes:</strong> {indicator.sourceKeys.join(", ")}</p></div>
              </details>
            ))}
          </div>
          <>
            <details className="mt-4 rounded-xl bg-[#f6f8f7] sm:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-extrabold text-[#37413c]"><span>Observações metodológicas</span><span className="text-xs text-[#69736d]">{context.observations.length}</span></summary>
              <div className="border-t border-[#e8ece9] px-4 py-3 space-y-2">{context.observations.map((item) => <p key={item} className="text-sm leading-5 text-[#56615b]">{item}</p>)}</div>
            </details>
            <div className="mt-5 hidden gap-2 sm:grid md:grid-cols-2">{context.observations.map((item) => <div key={item} className="rounded-xl bg-[#f6f8f7] px-4 py-3 text-sm text-[#56615b]">{item}</div>)}</div>
          </>
        </section>
      )}

      <section className="rounded-2xl border border-[#dfe6e2] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#157a55]"><Activity className="h-4 w-4" /> Mudanças observadas</div>
            <h2 className="mt-2 text-xl font-extrabold text-[#101513]">Evolução dos dados consolidados de Manaus</h2>
            <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-[#69736d] sm:block">Comparação descritiva entre snapshots diários. O painel informa o que mudou nos dados coletados, sem score eleitoral, perfilamento individual ou recomendação de direcionamento político.</p><p className="mt-2 text-sm leading-5 text-[#69736d] sm:hidden">Mudanças descritivas nos dados consolidados, sem perfilamento individual.</p>
          </div>
          {data?.currentPeriod && <div className="rounded-lg bg-[#f4f7f5] px-3 py-2 text-xs font-semibold text-[#69736d]">Atual: {data.currentPeriod}{data.previousPeriod ? ` · anterior: ${data.previousPeriod}` : ""}</div>}
        </div>

        {loading && <div className="mt-5 rounded-xl bg-[#f6f8f7] p-5 text-sm text-[#69736d]">Carregando histórico...</div>}
        {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && data && (
          <>
            <div className="mt-5 rounded-xl border border-[#e8ece9] bg-[#f8faf9] px-4 py-3 text-sm text-[#69736d]">{data.message}</div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 md:grid-cols-2 xl:grid-cols-3">
              {data.changes.map((change) => (
                <details key={change.metric} className="group rounded-xl border border-[#e5e9e6] bg-white p-4">
                  <summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#37413c]">{change.label}</p><p className="mt-2 text-2xl font-extrabold text-[#101513]">{formatNumber(change.current)}</p></div><Database className="h-4.5 w-4.5 text-[#8a928e]" /></div><div className="mt-3 flex items-center justify-between gap-3"><Delta change={change} />{change.previous != null && <span className="text-xs text-[#8a928e]">Anterior: {formatNumber(change.previous)}</span>}</div></summary>
                  <div className="mt-4 border-t border-[#eef0ee] pt-4 text-xs leading-5 text-[#69736d]"><p><strong className="text-[#37413c]">Metodologia:</strong> {change.methodology}</p><p className="mt-2"><strong className="text-[#37413c]">Fontes:</strong> {change.sourceKeys.join(", ") || "—"}</p><p className="mt-2"><strong className="text-[#37413c]">Coleta:</strong> {new Date(change.collectedAt).toLocaleString("pt-BR")}</p></div>
                </details>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
