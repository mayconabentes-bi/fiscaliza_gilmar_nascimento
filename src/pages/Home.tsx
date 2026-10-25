import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleDot, FileCheck2, MapPin, MessageSquareText, Radar, Route, ShieldCheck } from "lucide-react";
import { getPulsoAttribution, trackPulsoEvent, withPulsoAttribution } from "../lib/mobileAnalytics";
import { FiscalizeBrandMark } from "../components/FiscalizeBrand";

const etapas = [
  { icon: MessageSquareText, titulo: "Registre", texto: "Informe onde está o problema e o que aconteceu." },
  { icon: FileCheck2, titulo: "Receba o protocolo", texto: "Seu registro recebe um código para acompanhamento." },
  { icon: Route, titulo: "Acompanhe", texto: "Consulte o status e o histórico sempre que quiser." },
];

const fluxo = [
  { titulo: "Registro recebido", texto: "Seu relato entra no fluxo e recebe um protocolo." },
  { titulo: "Triagem e análise", texto: "As informações são organizadas para acompanhamento administrativo." },
  { titulo: "Andamento atualizado", texto: "Mudanças de status ficam registradas no histórico do caso." },
  { titulo: "Histórico consultável", texto: "Você consulta o andamento usando o protocolo." },
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
    <div className="pb-8 sm:pb-20">
      <section className="grid items-center gap-7 py-5 sm:min-h-[66vh] sm:gap-10 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-12">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5"><MapPin className="h-3.5 w-3.5" /> Manaus</span>
            <span className="hidden items-center rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#b84405] sm:inline-flex">Você cuidando da cidade</span>
          </div>

          <h1 className="mt-4 text-[2.25rem] font-extrabold leading-[1.01] tracking-[-0.055em] text-[#172033] sm:mt-5 sm:text-6xl lg:text-[4.65rem]">Viu um problema na cidade? Registre e acompanhe.</h1>

          <p className="mt-4 text-[15px] leading-6 text-[#657089] sm:hidden">Informe o local, descreva o problema e receba um protocolo para acompanhar o registro.</p>
          <p className="mt-6 hidden max-w-2xl text-base leading-8 text-[#657089] sm:block sm:text-lg">O FISCALIZE ajuda você a registrar problemas urbanos em Manaus: informe o local, descreva o problema e receba um protocolo para acompanhar o registro.</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3">
            <Link to={demandUrl} onClick={() => trackPulsoEvent('cta_registrar', attribution)} className="primary-button min-h-14 w-full px-6 text-base sm:w-auto">Registrar problema <ArrowRight className="h-4.5 w-4.5" /></Link>
            <Link to={protocolUrl} className="secondary-button min-h-14 w-full px-6 text-base sm:w-auto"><Radar className="h-4.5 w-4.5" /> Consultar protocolo</Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2.5 text-xs font-semibold text-[#657089] sm:mt-7 sm:gap-x-6 sm:gap-y-3 sm:text-sm">
            <span className="hidden items-center gap-2 sm:flex"><Check className="h-4 w-4 text-[#1f2e6e]" /> Feito para celular</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#1f2e6e]" /> Protocolo imediato</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#1f2e6e]" /> Seus dados protegidos</span>
          </div>
        </div>

        <div className="surface-card hidden overflow-hidden sm:block">
          <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#edf0f6] pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7c879d]">O que acontece depois do envio</p>
                <p className="mt-1 text-lg font-extrabold tracking-[-0.025em] text-[#1f2e6e]">Um fluxo claro do registro ao acompanhamento</p>
              </div>
              <FiscalizeBrandMark className="h-11 w-11 shadow-sm" />
            </div>
            <div className="mt-6 space-y-1">
              {fluxo.map((item, index) => (
                <div key={item.titulo} className="flex items-start gap-4 rounded-xl px-1 py-3.5">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${index === 0 ? 'bg-[#f36a10] text-white' : 'border border-[#d7e0f2] bg-white text-[#657089]'}`}>{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[#34425b]">{item.titulo}</p>
                    <p className="mt-1 text-xs leading-5 text-[#7c879d]">{item.texto}</p>
                  </div>
                  <CircleDot className={`mt-1 h-4 w-4 shrink-0 ${index === 0 ? 'text-[#f36a10]' : 'text-[#c6cfdf]'}`} />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-[#eef2fb] px-4 py-3 text-xs leading-relaxed text-[#526078]">O protocolo do FISCALIZE é interno e serve para acompanhar o registro. Ele não substitui os canais oficiais dos órgãos públicos e não representa garantia automática de solução.</div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dde4ef] py-8 sm:py-16" data-home-mobile-flow>
        <div className="sm:hidden">
          <span className="section-kicker">Como funciona</span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-[#172033]">Registre em três passos.</h2>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#dde4ef] bg-white">
            {etapas.map(({ icon: Icon, titulo, texto }, index) => (
              <div key={titulo} className="flex min-h-[88px] items-start gap-3 border-b border-[#eef2fb] px-4 py-4 last:border-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2fb] text-[#1f2e6e]"><Icon className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold text-[#172033]">{titulo}</h3>
                    <span className="text-[11px] font-extrabold text-[#f36a10]">0{index + 1}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#657089]">{texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-[#eef2fb] px-4 py-3 text-xs leading-5 text-[#526078]">O protocolo é do FISCALIZE e não substitui os canais oficiais dos órgãos públicos.</div>
        </div>

        <div className="hidden gap-8 sm:grid lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div className="max-w-md"><span className="section-kicker">Como funciona</span><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Do relato ao acompanhamento, em três passos.</h2><p className="mt-4 text-sm leading-7 text-[#657089]">Você sabe o que acontece em cada etapa, sem excesso de telas e sem promessas automáticas de resultado.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {etapas.map(({ icon: Icon, titulo, texto }, index) => <div key={titulo} className="soft-card p-5"><div className="flex items-center justify-between"><span className="icon-tile"><Icon className="h-5 w-5" /></span><span className="text-xs font-extrabold text-[#f36a10]">0{index + 1}</span></div><h3 className="mt-5 font-extrabold tracking-[-0.02em] text-[#172033]">{titulo}</h3><p className="mt-2 text-sm leading-6 text-[#657089]">{texto}</p></div>)}
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-16" data-home-trust>
        <div className="surface-card overflow-hidden sm:hidden">
          <div className="px-4 py-4">
            <span className="section-kicker">Seus dados são protegidos</span>
            <p className="mt-2 text-sm leading-6 text-[#657089]">Contato, fotos e informações internas não aparecem na consulta pública.</p>
            <p className="mt-2 text-xs leading-5 text-[#7b8599]">O FISCALIZE não usa seus dados para criar perfil político.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-[#eef2fb]">
            <Link to="/privacidade" className="flex min-h-12 items-center justify-between gap-2 border-r border-[#eef2fb] px-4 py-3 text-sm font-extrabold text-[#1f2e6e]">Privacidade <ArrowRight className="h-4 w-4 shrink-0" /></Link>
            <Link to="/transparencia" className="flex min-h-12 items-center justify-between gap-2 px-4 py-3 text-sm font-extrabold text-[#1f2e6e]">Sobre <ArrowRight className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>

        <div className="hidden gap-5 sm:grid lg:grid-cols-2">
          <div className="surface-card p-6 sm:p-8"><span className="section-kicker">Transparência</span><h2 className="mt-4 text-2xl font-extrabold tracking-[-0.035em] text-[#172033] sm:text-3xl">Cada registro mantém contexto e histórico.</h2><p className="mt-4 text-sm leading-7 text-[#657089] sm:text-base">Você acompanha o andamento pelo protocolo e vê as mudanças de status registradas ao longo do caso.</p><Link to={protocolUrl} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#1f2e6e]">Consultar protocolo <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="surface-card p-6 sm:p-8"><span className="section-kicker">Privacidade</span><h2 className="mt-4 text-2xl font-extrabold tracking-[-0.035em] text-[#172033] sm:text-3xl">Dados usados para registrar e acompanhar o caso.</h2><p className="mt-4 text-sm leading-7 text-[#657089] sm:text-base">A consulta pública não exibe contato, descrição, foto ou observações internas. O projeto não usa seus dados para criar perfil político.</p><Link to="/privacidade" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#1f2e6e]">Ver privacidade <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      <section className="hidden rounded-[1.75rem] bg-[#1f2e6e] px-6 py-8 text-white shadow-[0_22px_55px_rgba(31,46,110,0.16)] sm:block sm:px-9 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#ffd1b1]">Você cuidando da cidade</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em]">Tem uma situação para registrar?</h2><p className="mt-3 text-sm leading-7 text-[#dce3f4] sm:text-base">Envie quando estiver pronto. Não há contagem regressiva, pontuação ou penalidade; o objetivo é registrar bem o caso e permitir seu acompanhamento.</p></div>
        <Link to={demandUrl} onClick={() => trackPulsoEvent('cta_registrar', attribution)} className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#f36a10] px-6 py-4 text-base font-extrabold text-white transition hover:bg-[#b84405] lg:mt-0 lg:w-auto">Começar registro <ArrowRight className="h-4.5 w-4.5" /></Link>
      </section>

    </div>
  );
}
