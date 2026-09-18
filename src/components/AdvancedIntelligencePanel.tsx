import { useEffect, useState } from "react";
import { Building2, Landmark, MapPinned } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

type InstitutionResponse = { total: number; institutions: Array<{ nome: string; sigla?: string | null; cnpj: string; tipo: string }> };
type FiscalResponse = {
  year: number;
  stages: Record<string, { value: number; account: string; column: string } | null>;
  methodology: string;
};
type QualityResponse = {
  dimensions: Array<{ key: string; received: number; classified: number; unclassified: number; coverage: number }>;
  methodology: string;
};

const dimensionLabels: Record<string, string> = {
  works: "Obras municipais",
  health: "Unidades de saúde",
  schools: "Escolas municipais",
};

const stageLabels: Record<string, string> = {
  previsto: "Previsto / dotação observada",
  realizado: "Receita realizada observada",
  empenhado: "Despesa empenhada observada",
  liquidado: "Despesa liquidada observada",
  pago: "Despesa paga observada",
};

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function AdvancedIntelligencePanel() {
  const [institutions, setInstitutions] = useState<InstitutionResponse | null>(null);
  const [fiscal, setFiscal] = useState<FiscalResponse | null>(null);
  const [quality, setQuality] = useState<QualityResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const tasks: Array<() => Promise<void>> = [
        async () => {
          const response = await fetchWithTimeout("/api/intelligence/institutions", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setInstitutions(await response.json());
        },
        async () => {
          const response = await fetchWithTimeout("/api/intelligence/fiscal/overview", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setFiscal(await response.json());
        },
        async () => {
          const response = await fetchWithTimeout("/api/intelligence/quality/territorial", { credentials: "same-origin", cache: "no-store", signal: controller.signal }, 7000);
          if (response.ok && !controller.signal.aborted) setQuality(await response.json());
        },
      ];

      for (const task of tasks) {
        if (controller.signal.aborted) break;
        try { await task(); } catch (error: any) {
          if (controller.signal.aborted || error?.name === "AbortError") break;
        }
      }
    })();

    return () => controller.abort();
  }, []);

  if (!institutions && !fiscal && !quality) return null;

  return (
    <section className="rounded-2xl border border-[#dbe8e0] bg-white p-4 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-wide text-[#157a55]">Camada avançada</p>
        <h2 className="mt-2 text-xl font-extrabold text-[#101513]">Cobertura de CNPJs públicos, fiscal e territorial</h2>
        <p className="mt-2 hidden max-w-4xl text-sm text-[#69736d] sm:block">Indicadores técnicos derivados de fontes públicas. Valores fiscais preservam a conta e a coluna de origem para auditoria e evitam somar linhas hierárquicas do SICONFI.</p><p className="mt-2 text-sm leading-5 text-[#69736d] sm:hidden">Cobertura fiscal e territorial com origem auditável.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#e5e9e6] p-4 sm:p-5">
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#157a55]" /><h3 className="font-bold text-[#101513]">Cadastro de CNPJs públicos</h3></div>
          <p className="mt-3 text-3xl font-extrabold text-[#101513]">{institutions?.total ?? "—"}</p>
          <p className="mt-1 text-sm text-[#69736d]">CNPJs auditáveis usados na ampliação das consultas ao PNCP.</p>
        </div>

        <div className="rounded-xl border border-[#e5e9e6] p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center gap-2"><Landmark className="h-5 w-5 text-[#157a55]" /><h3 className="font-bold text-[#101513]">Execução fiscal observada {fiscal?.year ?? ""}</h3></div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5">
            {Object.entries(stageLabels).map(([key, label]) => {
              const stage = fiscal?.stages?.[key];
              return <div key={key} className="rounded-lg bg-[#f7fbf9] p-3"><p className="text-[10px] font-bold uppercase leading-4 tracking-wide text-[#69736d] sm:text-[11px]">{label}</p><p className="mt-1.5 text-sm font-extrabold text-[#101513] sm:mt-2 sm:text-base">{money(stage?.value)}</p>{stage?.account && <p className="mt-1 hidden line-clamp-2 text-[11px] text-[#8a928e] sm:block">{stage.account}</p>}</div>;
            })}
          </div>
          {fiscal?.methodology && <p className="mt-3 text-xs text-[#8a928e]">{fiscal.methodology}</p>}
        </div>
      </div>

      {quality?.dimensions?.length ? (
        <>
          <details className="mt-4 rounded-xl border border-[#e5e9e6] sm:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 font-bold text-[#101513]"><MapPinned className="h-5 w-5 text-[#157a55]" /> Qualidade territorial</span>
              <span className="text-xs font-semibold text-[#69736d]">{quality.dimensions.length} dimensões</span>
            </summary>
            <div className="border-t border-[#eef0ee] px-4 py-2">
              {quality.dimensions.map((item) => <div key={item.key} className="flex min-h-12 items-center justify-between gap-3 border-b border-[#f0f2f1] py-2 last:border-0"><span className="text-sm font-semibold text-[#37413c]">{dimensionLabels[item.key] || item.key}</span><span className="font-extrabold text-[#157a55]">{(item.coverage * 100).toFixed(1)}%</span></div>)}
            </div>
          </details>
          <div className="mt-5 hidden rounded-xl border border-[#e5e9e6] p-5 sm:block">
            <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-[#157a55]" /><h3 className="font-bold text-[#101513]">Qualidade da territorialização</h3></div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {quality.dimensions.map((item) => <div key={item.key} className="rounded-lg bg-[#f7fbf9] p-4"><p className="font-bold text-[#101513]">{dimensionLabels[item.key] || item.key}</p><p className="mt-2 text-sm text-[#56615b]">Recebidos: <strong>{item.received.toLocaleString("pt-BR")}</strong></p><p className="text-sm text-[#56615b]">Territorializados: <strong>{item.classified.toLocaleString("pt-BR")}</strong></p><p className="text-sm text-[#56615b]">Sem classificação: <strong>{item.unclassified.toLocaleString("pt-BR")}</strong></p><p className="mt-2 text-lg font-extrabold text-[#157a55]">{(item.coverage * 100).toFixed(1)}%</p></div>)}
            </div>
            <p className="mt-3 text-xs text-[#8a928e]">{quality.methodology}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
