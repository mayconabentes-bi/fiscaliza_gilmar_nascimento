import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileText, MapPinned, Radar, ShieldCheck, Tag, Flag, LockKeyhole, FileBarChart, ArrowUpRight, Activity } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

const modules = [
  { to: "/admin/demandas", title: "Triagem de demandas", description: "Analise registros, altere status e acompanhe o histórico.", icon: FileText },
  { to: "/radar-manaus", title: "Radar Territorial", description: "Visualize sinais do território, temas recorrentes e contexto de Manaus.", icon: MapPinned },
  { to: "/estrategia-2028", title: "Estratégia", description: "Acesse a camada privada de leitura estratégica e acompanhamento territorial.", icon: Flag },
  { to: "/admin", title: "Governança interna", description: "Moderação, controles e registros operacionais privados.", icon: ShieldCheck },
  { to: "/admin/audit", title: "Auditoria e segurança", description: "Consulte eventos, integridade e controles administrativos.", icon: LockKeyhole },
  { to: "/relatorios", title: "Relatórios", description: "Explore relatórios consolidados e saídas analíticas privadas.", icon: FileBarChart },
];

export default function DashboardPrivado() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(false);

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
    { label: "Recebidas", value: resumo.total, icon: FileText, hint: "Registros com protocolo", critical: false },
    { label: "Pendentes", value: resumo.pendentes, icon: Clock, hint: "Aguardando análise", critical: false },
    { label: "Concluídas", value: resumo.concluidas, icon: CheckCircle2, hint: "Com status final", critical: false },
    { label: "Críticas", value: resumo.criticas, icon: AlertTriangle, hint: "Prioridade máxima", critical: true },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-9 py-1 sm:py-4">
      <section className="surface-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f2e6e] via-[#1f2e6e] to-[#f36a10]" aria-hidden="true" />
        <div className="section-kicker"><Activity className="h-4 w-4" /> FISCALIZE · Núcleo privado</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#18255c] sm:text-4xl">Painel de operação e inteligência</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#657089] sm:text-base">Ambiente autenticado para triagem, leitura territorial, governança, auditoria e acompanhamento dos registros recebidos pelo canal público.</p>
      </section>

      <section>
        <div className="mb-5"><p className="text-sm font-extrabold text-[#172033]">Módulos privados</p><p className="mt-1 text-sm text-[#657089]">Acesso rápido às ferramentas internas do projeto.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ to, title, description, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-[#dde4ef] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#b9c7e4] hover:shadow-[0_12px_30px_rgba(31,46,110,0.08)]">
              <div className="flex items-start justify-between gap-4"><span className="icon-tile"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-[#9aa5ba] transition group-hover:text-[#c94d06]" /></div>
              <h2 className="mt-5 text-base font-extrabold text-[#172033]">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[#657089]">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5"><p className="text-sm font-extrabold text-[#172033]">Demandas recebidas</p><p className="mt-1 text-sm text-[#657089]">Indicadores agregados do canal público.</p></div>
        {metricsError && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">As métricas não puderam ser carregadas agora.</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-[#dde4ef] bg-white p-4 shadow-[0_1px_2px_rgba(31,46,110,0.02)] sm:p-5"><div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${card.critical ? "text-red-600" : "text-[#1f2e6e]"}`} />{loading && <span className="h-4 w-8 animate-pulse rounded bg-[#eef2fb]" />}</div><div className="mt-5 text-2xl font-extrabold text-[#172033]">{loading ? "—" : card.value}</div><div className="mt-1 text-sm font-bold text-[#34425b]">{card.label}</div><div className="mt-1 text-xs text-[#7b8599]">{card.hint}</div></div>; })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5"><div className="flex items-center gap-2 font-extrabold text-[#172033]"><BarChart3 className="h-4.5 w-4.5 text-[#1f2e6e]" /> Por status</div><div className="mt-5 space-y-3">{(data?.porStatus || []).map((item: any) => <div key={item.status} className="flex justify-between text-sm"><span className="text-[#657089]">{item.status}</span><span className="font-extrabold text-[#172033]">{item.total}</span></div>)}</div></div>
        <div className="surface-card p-5"><div className="flex items-center gap-2 font-extrabold text-[#172033]"><Radar className="h-4.5 w-4.5 text-[#1f2e6e]" /> Municípios</div><div className="mt-5 space-y-3">{(data?.porMunicipio || []).map((item: any) => <div key={item.municipio} className="flex justify-between text-sm"><span className="text-[#657089]">{item.municipio}</span><span className="font-extrabold text-[#172033]">{item.total}</span></div>)}</div></div>
        <div className="surface-card p-5"><div className="flex items-center gap-2 font-extrabold text-[#172033]"><Tag className="h-4.5 w-4.5 text-[#1f2e6e]" /> Categorias</div><div className="mt-5 space-y-3">{(data?.porCategoria || []).map((item: any) => <div key={item.categoria} className="flex justify-between text-sm"><span className="text-[#657089]">{item.categoria}</span><span className="font-extrabold text-[#172033]">{item.total}</span></div>)}</div></div>
      </section>
    </div>
  );
}
