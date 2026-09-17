import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDot, FileCheck2, MapPin, MessageSquareText, Radar, Route, ShieldCheck } from "lucide-react";
import { getPulsoAttribution, trackPulsoEvent, withPulsoAttribution } from "../lib/mobileAnalytics";

const etapas = [
  { icon: MessageSquareText, titulo: "Registre", texto: "Conte o que aconteceu e informe onde." },
  { icon: FileCheck2, titulo: "Receba o protocolo", texto: "Guarde o código gerado no envio." },
  { icon: Route, titulo: "Acompanhe", texto: "Consulte as atualizações quando quiser." },
];

export default function Home() {
  const attribution = getPulsoAttribution();
  const demandUrl = withPulsoAttribution('/demandas/nova', attribution);
  const protocolUrl = withPulsoAttribution('/protocolo', attribution);

  useEffect(() => {
    const key = `pulso_landing_${attribution.src || 'direct'}_${attribution.acao || 'none'}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackPulsoEvent(attribution.src || attribution.acao ? 'qr_landing' : 'home_view', attribution);
  }, [attribution.src, attribution.acao]);

  return (
    <div className="pb-20">
      <section className="grid min-h-[66vh] items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
        <div className="max-w-3xl">
          <span className="section-kicker"><MapPin className="h-3.5 w-3.5" /> Manaus</span>
          <h1 className="mt-5 text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.06em] text-[#101513] sm:text-6xl lg:text-[4.65rem]">Problemas do bairro, organizados em um só lugar.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[#69736d] sm:text-lg">Registre uma situação, receba um protocolo e acompanhe o histórico sem burocracia.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={demandUrl} onClick={() => trackPulsoEvent('cta_registrar', attribution)} className="primary-button min-h-14 px-6 text-base">Registrar problema <ArrowRight className="h-4.5 w-4.5" /></Link>
            <Link to={protocolUrl} className="secondary-button min-h-14 px-6 text-base"><Radar className="h-4.5 w-4.5 text-[#157a55]" /> Acompanhar protocolo</Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#69736d]">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#157a55]" /> Mobile-first</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#157a55]" /> Protocolo imediato</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#157a55]" /> Uso independente</span>
          </div>
        </div>

        <div className="surface-card p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-[#edf0ee] pb-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a928e]">Acompanhamento</p><p className="mt-1 text-lg font-extrabold tracking-[-0.025em]">Uma jornada simples</p></div>
            <span className="icon-tile"><Radar className="h-4.5 w-4.5" /></span>
          </div>
          <div className="mt-6 space-y-1">
            {["Registro recebido", "Informações organizadas", "Encaminhamento registrado", "Histórico atualizado"].map((item, index) => (
              <div key={item} className="flex items-center gap-4 rounded-xl px-1 py-3.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${index === 0 ? 'bg-[#157a55] text-white' : 'border border-[#dfe5e1] bg-white text-[#69736d]'}`}>{index + 1}</span>
                <span className="flex-1 text-sm font-semibold text-[#37413c]">{item}</span>
                <CircleDot className={`h-4 w-4 ${index === 0 ? 'text-[#157a55]' : 'text-[#c6cec9]'}`} />
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-[#f5f7f5] px-4 py-3 text-xs leading-relaxed text-[#69736d]">O FISCALIZE não substitui os canais oficiais. Ele organiza relatos e acompanhamento em uma experiência simples.</div>
        </div>
      </section>

      <section className="border-y border-[#e6eae7] py-14 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div className="max-w-md"><span className="section-kicker">Como funciona</span><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Três passos. Sem excesso de telas.</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {etapas.map(({ icon: Icon, titulo, texto }, index) => <div key={titulo} className="soft-card p-5"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#157a55]" /><span className="text-xs font-bold text-[#a5ada8]">0{index + 1}</span></div><h3 className="mt-5 font-extrabold tracking-[-0.02em]">{titulo}</h3><p className="mt-2 text-sm leading-6 text-[#69736d]">{texto}</p></div>)}
          </div>
        </div>
      </section>

      <section className="grid gap-5 py-14 sm:py-16 lg:grid-cols-2">
        <div className="surface-card p-6 sm:p-8"><span className="section-kicker">Transparência</span><h2 className="mt-4 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">Cada registro mantém contexto e histórico.</h2><p className="mt-4 text-sm leading-7 text-[#69736d] sm:text-base">Você acompanha o andamento pelo protocolo e vê o que aconteceu em cada etapa.</p><Link to={protocolUrl} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#157a55]">Consultar protocolo <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="surface-card p-6 sm:p-8"><span className="section-kicker">Privacidade</span><h2 className="mt-4 text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">Dados só para registrar e acompanhar o caso.</h2><p className="mt-4 text-sm leading-7 text-[#69736d] sm:text-base">O projeto não usa seus dados para criar perfil político. Informações sensíveis não são solicitadas no registro.</p><Link to="/privacidade" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#157a55]">Ver privacidade <ArrowRight className="h-4 w-4" /></Link></div>
      </section>

      <section className="rounded-[1.75rem] bg-[#101513] px-6 py-8 text-white sm:px-9 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#9fcbb7]">Participação aberta</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em]">Tem algo acontecendo no seu bairro?</h2><p className="mt-3 text-sm leading-7 text-[#b8c0bc] sm:text-base">Registre agora e guarde seu protocolo.</p></div>
        <Link to={demandUrl} onClick={() => trackPulsoEvent('cta_registrar', attribution)} className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-extrabold text-[#101513] transition hover:bg-[#eef2ef] lg:mt-0 lg:w-auto">Começar registro <ArrowRight className="h-4.5 w-4.5" /></Link>
      </section>
    </div>
  );
}
