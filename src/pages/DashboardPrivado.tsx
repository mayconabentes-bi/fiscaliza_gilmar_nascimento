import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileText, MapPinned, Radar, ShieldCheck, Tag, Flag, LockKeyhole, FileBarChart, ArrowUpRight, Activity } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

const modules = [
  { to: "/admin/demandas", title: "Triagem", desktopTitle: "Triagem de demandas", description: "Analise registros, altere status e acompanhe o histórico.", icon: FileText },
  { to: "/radar-manaus", title: "Radar", desktopTitle: "Radar Territorial", description: "Visualize sinais do território, temas recorrentes e contexto de Manaus.", icon: MapPinned },
  { to: "/estrategia-2028", title: "Estratégia", desktopTitle: "Estratégia", description: "Acesse a camada privada de leitura estratégica e acompanhamento territorial.", icon: Flag },
  { to: "/admin", title: "Governança", desktopTitle: "Governança interna", description: "Moderação, controles e registros operacionais privados.", icon: ShieldCheck },
  { to: "/admin/audit", title: "Auditoria", desktopTitle: "Auditoria e segurança", description: "Consulte eventos, integridade e controles administrativos.", icon: LockKeyhole },
  { to: "/relatorios", title: "Relatórios", desktopTitle: "Relatórios", description: "Explore relatórios consolidados e saídas analíticas privadas.", icon: FileBarChart },
];

type AnalysisTab = "status" | "territorio" | "categorias";

function humanizeStatus(value: string) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export default function DashboardPrivado() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("status");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchWithTimeout("/api/demandas/metricas", { signal: controller.signal, cache: "no-store" }, 8000)
      .then((res) => { if (!res.ok) throw new Error("Erro ao carregar métricas."); return res.json(); })
      .then((payload) => { if (active) setData(payload); })
      .catch((error: any) => {
        if (!active || error?.name === "AbortError") return;
        setMetricsError(true);
        setData(null);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const resumo = data?.resumo || { total: 0, concluidas: 0, pendentes: 0, criticas: 0 };
  const cards = [
    { label: "Recebidas", value: resumo.total, icon: FileText, hint: "Registros com protocolo", critical: false, to: "/admin/demandas" },
    { label: "Pendentes", value: resumo.pendentes, icon: Clock, hint: "Aguardando análise", critical: false, to: "/admin/demandas?status=RECEBIDA" },
    { label: "Concluídas", value: resumo.concluidas, icon: CheckCircle2, hint: "Com status final", critical: false, to: "/admin/demandas?status=CONCLUIDA" },
    { label: "Críticas", value: resumo.criticas, icon: AlertTriangle, hint: "Prioridade máxima", critical: true, to: "/admin/demandas?prioridade=CRITICA" },
  ];

  const analysis = useMemo(() => ({
    status: {
      label: "Status",
      icon: BarChart3,
      items: (data?.porStatus || []).map((item: any) => ({ label: humanizeStatus(item.status), total: item.total })),
    },
    territorio: {
      label: "Território",
      icon: Radar,
      items: (data?.porMunicipio || []).map((item: any) => ({ label: item.municipio, total: item.total })),
    },
    categorias: {
      label: "Categorias",
      icon: Tag,
      items: (data?.porCategoria || []).map((item: any) => ({ label: item.categoria, total: item.total })),
    },
  }), [data]);

  const activeAnalysis = analysis[analysisTab];
  const ActiveAnalysisIcon = activeAnalysis.icon;

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-1 sm:space-y-9 sm:py-4">
      <section className="surface-card relative overflow-hidden px-5 py-5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f2e6e] via-[#1f2e6e] to-[#f36a10]" aria-hidden="true" />
        <div className="section-kicker"><Activity className="h-4 w-4" /> FISCALIZE · Núcleo privado</div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#18255c] sm:mt-3 sm:text-4xl">Painel de operação</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#657089] sm:hidden">Visão geral das demandas e ferramentas internas.</p>
        <p className="mt-3 hidden max-w-3xl text-base leading-relaxed text-[#657089] sm:block">Ambiente autenticado para triagem, leitura territorial, governança, auditoria e acompanhamento dos registros recebidos pelo canal público.</p>
      </section>

      <section aria-labelledby="dashboard-indicators-title">
        <div className="mb-3 sm:mb-5">
          <p id="dashboard-indicators-title" className="text-sm font-extrabold text-[#172033]">Demandas recebidas</p>
          <p className="mt-1 hidden text-sm text-[#657089] sm:block">Indicadores agregados do canal público.</p>
        </div>

        {metricsError && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">As métricas não puderam ser carregadas agora.</div>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                to={card.to}
                className={`group rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(31,46,110,0.02)] transition active:scale-[0.99] sm:p-5 ${card.critical ? "border-red-100 hover:border-red-200" : "border-[#dde4ef] hover:border-[#b9c7e4]"}`}
                aria-label={`${card.label}: ${loading ? "carregando" : card.value}. Abrir triagem.`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${card.critical ? "text-red-600" : "text-[#1f2e6e]"}`} />
                  {loading ? <span className="h-4 w-8 animate-pulse rounded bg-[#eef2fb]" /> : <ArrowUpRight className="h-4 w-4 text-[#a1aabd] transition group-hover:text-[#c94d06]" />}
                </div>
                <div className="mt-3 text-2xl font-extrabold text-[#172033] sm:mt-5">{loading ? "—" : card.value}</div>
                <div className="mt-1 text-sm font-bold text-[#34425b]">{card.label}</div>
                <div className="mt-1 text-[11px] leading-4 text-[#7b8599] sm:text-xs">{card.hint}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={`rounded-2xl border p-4 sm:p-5 ${Number(resumo.criticas) > 0 ? "border-red-200 bg-red-50/70" : "border-[#d9e1ef] bg-white"}`} aria-labelledby="attention-title">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${Number(resumo.criticas) > 0 ? "bg-red-100 text-red-600" : "bg-[#eef2fb] text-[#1f2e6e]"}`}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="attention-title" className="font-extrabold text-[#172033]">Atenção necessária</p>
            <p className="mt-1 text-sm leading-5 text-[#657089]">
              {loading ? "Carregando fila operacional..." : Number(resumo.criticas) > 0
                ? `${resumo.criticas} demanda${Number(resumo.criticas) === 1 ? "" : "s"} crítica${Number(resumo.criticas) === 1 ? "" : "s"} e ${resumo.pendentes} aguardando análise.`
                : `Nenhuma demanda crítica. ${resumo.pendentes} aguardando análise.`}
            </p>
          </div>
          <Link to={Number(resumo.criticas) > 0 ? "/admin/demandas?prioridade=CRITICA" : "/admin/demandas?status=RECEBIDA"} className="hidden shrink-0 items-center gap-1 rounded-xl border border-[#d7e0f2] bg-white px-3 py-2 text-xs font-extrabold text-[#1f2e6e] sm:inline-flex">
            Ver fila <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Link to={Number(resumo.criticas) > 0 ? "/admin/demandas?prioridade=CRITICA" : "/admin/demandas?status=RECEBIDA"} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f2e6e] px-4 py-2.5 text-sm font-extrabold text-white sm:hidden">
          Ver fila de triagem <ArrowUpRight className="h-4 w-4" />
        </Link>
      </section>

      <section aria-labelledby="dashboard-modules-title">
        <div className="mb-3 sm:mb-5">
          <p id="dashboard-modules-title" className="text-sm font-extrabold text-[#172033]">Ações rápidas</p>
          <p className="mt-1 hidden text-sm text-[#657089] sm:block">Acesso rápido às ferramentas internas do projeto.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ to, title, desktopTitle, description, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-[#dde4ef] bg-white p-4 transition active:scale-[0.99] hover:border-[#b9c7e4] hover:shadow-[0_12px_30px_rgba(31,46,110,0.08)] sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="icon-tile"><Icon className="h-5 w-5" /></span>
                <ArrowUpRight className="h-4 w-4 text-[#9aa5ba] transition group-hover:text-[#c94d06]" />
              </div>
              <h2 className="mt-3 text-sm font-extrabold text-[#172033] sm:mt-5 sm:text-base"><span className="sm:hidden">{title}</span><span className="hidden sm:inline">{desktopTitle}</span></h2>
              <p className="mt-2 hidden text-sm leading-relaxed text-[#657089] sm:block">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="dashboard-analysis-title">
        <div className="mb-3 sm:mb-5">
          <p id="dashboard-analysis-title" className="text-sm font-extrabold text-[#172033]">Visão analítica</p>
          <p className="mt-1 hidden text-sm text-[#657089] sm:block">Distribuição consolidada das demandas recebidas.</p>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="flex gap-1 border-b border-[#e6ebf4] bg-[#f8faff] p-1.5" role="tablist" aria-label="Visão analítica">
            {(Object.keys(analysis) as AnalysisTab[]).map((tab) => {
              const item = analysis[tab];
              const selected = analysisTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setAnalysisTab(tab)}
                  className={`min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-extrabold transition sm:text-sm ${selected ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#6f7a90] hover:text-[#1f2e6e]"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5" role="tabpanel">
            <div className="flex items-center gap-2 font-extrabold text-[#172033]">
              <ActiveAnalysisIcon className="h-4.5 w-4.5 text-[#1f2e6e]" />
              {activeAnalysis.label}
            </div>

            <div className="mt-4 space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-xl bg-[#f1f4fa]" />)
              ) : activeAnalysis.items.length === 0 ? (
                <p className="py-4 text-sm text-[#7b8599]">Nenhum dado disponível para esta visão.</p>
              ) : activeAnalysis.items.map((item: any) => (
                <div key={item.label} className="flex min-h-10 items-center justify-between gap-4 rounded-xl px-3 py-2 hover:bg-[#fafbfe]">
                  <span className="min-w-0 truncate text-sm text-[#657089]">{item.label}</span>
                  <span className="shrink-0 text-sm font-extrabold text-[#172033]">{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
