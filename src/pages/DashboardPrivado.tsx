import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, FileText, MapPinned, Radar, ShieldCheck, Tag, Flag, LockKeyhole, FileBarChart, ArrowUpRight, Activity } from "lucide-react";

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
    fetch("/api/demandas/metricas")
      .then((res) => { if (!res.ok) throw new Error("Erro ao carregar métricas."); return res.json(); })
      .then(setData)
      .catch(() => { setMetricsError(true); setData(null); })
      .finally(() => setLoading(false));
  }, []);

  const resumo = data?.resumo || { total: 0, concluidas: 0, pendentes: 0, criticas: 0 };
  const cards = [
    { label: "Recebidas", value: resumo.total, icon: FileText, hint: "Registros com protocolo" },
    { label: "Pendentes", value: resumo.pendentes, icon: Clock, hint: "Aguardando análise" },
    { label: "Concluídas", value: resumo.concluidas, icon: CheckCircle2, hint: "Com status final" },
    { label: "Críticas", value: resumo.criticas, icon: AlertTriangle, hint: "Prioridade máxima" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10 py-3 sm:py-6">
      <section className="border-b border-[#e5e9e6] pb-8">
        <div className="section-kicker"><Activity className="h-4 w-4" /> Núcleo privado</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#101513] sm:text-4xl">Inteligência e operação</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#69736d] sm:text-base">Ambiente reservado ao administrador do projeto para análise territorial, estratégia e gestão dos registros recebidos pelo canal público.</p>
      </section>

      <section>
        <div className="mb-5"><p className="text-sm font-extrabold text-[#101513]">Módulos privados</p><p className="mt-1 text-sm text-[#69736d]">Ferramentas internas do projeto.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ to, title, description, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-[#e5e9e6] bg-white p-5 transition hover:border-[#cfd8d2] hover:shadow-sm">
              <div className="flex items-start justify-between gap-4"><span className="icon-tile"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-[#a2aaa5]" /></div>
              <h2 className="mt-5 text-base font-extrabold text-[#101513]">{title}</h2><p className="mt-2 text-sm leading-relaxed text-[#69736d]">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5"><p className="text-sm font-extrabold text-[#101513]">Demandas recebidas</p><p className="mt-1 text-sm text-[#69736d]">Indicadores agregados do canal público.</p></div>
        {metricsError && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">As métricas não puderam ser carregadas agora.</div>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-[#e5e9e6] bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#157a55]" />{loading && <span className="h-4 w-8 animate-pulse rounded bg-[#eef1ef]" />}</div><div className="mt-5 text-2xl font-extrabold text-[#101513]">{loading ? "—" : card.value}</div><div className="mt-1 text-sm font-bold text-[#37413c]">{card.label}</div><div className="mt-1 text-xs text-[#8a928e]">{card.hint}</div></div>; })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#e5e9e6] bg-white p-5"><div className="flex items-center gap-2 font-extrabold"><BarChart3 className="h-4.5 w-4.5 text-[#157a55]" /> Por status</div><div className="mt-5 space-y-3">{(data?.porStatus || []).map((item: any) => <div key={item.status} className="flex justify-between text-sm"><span className="text-[#69736d]">{item.status}</span><span className="font-extrabold">{item.total}</span></div>)}</div></div>
        <div className="rounded-2xl border border-[#e5e9e6] bg-white p-5"><div className="flex items-center gap-2 font-extrabold"><Radar className="h-4.5 w-4.5 text-[#157a55]" /> Municípios</div><div className="mt-5 space-y-3">{(data?.porMunicipio || []).map((item: any) => <div key={item.municipio} className="flex justify-between text-sm"><span className="text-[#69736d]">{item.municipio}</span><span className="font-extrabold">{item.total}</span></div>)}</div></div>
        <div className="rounded-2xl border border-[#e5e9e6] bg-white p-5"><div className="flex items-center gap-2 font-extrabold"><Tag className="h-4.5 w-4.5 text-[#157a55]" /> Categorias</div><div className="mt-5 space-y-3">{(data?.porCategoria || []).map((item: any) => <div key={item.categoria} className="flex justify-between text-sm"><span className="text-[#69736d]">{item.categoria}</span><span className="font-extrabold">{item.total}</span></div>)}</div></div>
      </section>
    </div>
  );
}
