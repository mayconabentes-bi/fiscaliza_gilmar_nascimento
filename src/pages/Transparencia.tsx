import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff, FileText, Landmark, ShieldCheck, UserRound, Waypoints } from "lucide-react";
import { FiscalizeBrandMark } from "../components/FiscalizeBrand";

const pilares = [
  {
    icon: UserRound,
    titulo: "Quem mantém o FISCALIZE",
    texto: "O FISCALIZE é uma iniciativa cívica independente criada por Maycon A. Bentes, com Co-Fundação/Criação de Thauã Malinowski e apoio de Arthur Azevedo. Conforme a Política de Privacidade, Maycon A. Bentes responde pelas principais decisões sobre o tratamento de dados pessoais nesta versão pública."
  },
  {
    icon: Waypoints,
    titulo: "O que a plataforma faz",
    texto: "Recebe e organiza registros sobre problemas urbanos, gera um protocolo interno e permite acompanhar as atualizações que forem registradas no FISCALIZE."
  },
  {
    icon: Landmark,
    titulo: "O que a plataforma não é",
    texto: "O FISCALIZE não é canal oficial da Prefeitura de Manaus, do Governo do Amazonas ou da Câmara Municipal de Manaus, não atua em nome de agentes políticos e não substitui os canais oficiais dos órgãos públicos."
  },
  {
    icon: ShieldCheck,
    titulo: "Participar não significa apoiar",
    texto: "Registrar um problema, criar uma conta ou consultar um protocolo não cria vínculo de apoio pessoal, político ou eleitoral. Dados cívicos não devem ser usados para inferir preferência política individual."
  }
];

const compromissos = [
  "Mostrar apenas informações necessárias na consulta pública por protocolo.",
  "Manter fotos, contato, descrição detalhada e informações internas fora da consulta pública.",
  "Distinguir o que foi registrado no FISCALIZE do que depende de confirmação de órgão público.",
  "Não atribuir ao FISCALIZE ações realizadas por órgãos públicos ou terceiros.",
  "Identificar exemplos como exemplos e apresentar fonte e período quando divulgarmos resultados agregados."
];

const resumoRapido = [
  "Iniciativa cívica independente",
  "Não é canal oficial de órgão público",
  "Participar não cria vínculo político"
];

const dadosPublicos = [
  "Protocolo do FISCALIZE",
  "Status do acompanhamento",
  "Histórico de atualizações necessário à consulta"
];

const dadosProtegidos = [
  "Contato do cidadão",
  "Fotos enviadas",
  "Descrição detalhada e informações internas"
];

export default function Transparencia() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2 sm:space-y-8 sm:py-8">
      <header className="overflow-hidden rounded-[1.5rem] border border-[#dde4ef] bg-white" data-transparency-hero>
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="grid gap-5 p-5 sm:gap-7 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-kicker rounded-full border border-[#d7e0f2] bg-[#f7f9fd] px-3 py-1.5">Transparência</span>
              <span className="rounded-full bg-[#eef2fb] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1f2e6e]">Independente e não oficial</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl">Saiba quem mantém o FISCALIZE e quais são os limites da plataforma.</h1>
            <p className="mt-3 text-sm leading-6 text-[#657089] sm:mt-4 sm:text-base sm:leading-7">Aqui você encontra, de forma direta, o que o FISCALIZE faz, o que não faz e como protege as informações usadas no acompanhamento dos registros.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {resumoRapido.map((item) => (
                <div key={item} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e3e8f2] bg-[#f8fafe] px-3 py-2.5 text-xs font-bold leading-5 text-[#526078]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1f2e6e]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden justify-start sm:flex lg:justify-end"><FiscalizeBrandMark className="h-16 w-16 shadow-sm" /></div>
        </div>
      </header>

      <section data-transparency-data className="grid gap-3 md:grid-cols-2">
        <article className="surface-card p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="icon-tile shrink-0"><Eye className="h-5 w-5" /></span>
            <div>
              <span className="section-kicker">Na consulta pública</span>
              <h2 className="mt-2 text-lg font-extrabold text-[#172033] sm:text-xl">O que pode aparecer.</h2>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {dadosPublicos.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-6 text-[#657089]">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#1f2e6e]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="surface-card p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="icon-tile shrink-0"><EyeOff className="h-5 w-5" /></span>
            <div>
              <span className="section-kicker">Protegido</span>
              <h2 className="mt-2 text-lg font-extrabold text-[#172033] sm:text-xl">O que não fica público.</h2>
            </div>
          </div>
          <ul className="mt-4 space-y-2.5">
            {dadosProtegidos.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-6 text-[#657089]">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#1f2e6e]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section data-transparency-principles>
        <div className="mb-4">
          <span className="section-kicker">Sobre o projeto</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-[#172033]">O essencial, sem letras miúdas.</h2>
        </div>
        <div className="grid gap-3 sm:gap-5 md:grid-cols-2">
          {pilares.map(({ icon: Icon, titulo, texto }, index) => (
            <article key={titulo} className="surface-card p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="icon-tile shrink-0"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-extrabold text-[#f36a10]">0{index + 1}</span>
                <h2 className="text-base font-extrabold text-[#172033] sm:text-lg">{titulo}</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#657089]">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section data-transparency-commitments className="surface-card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="icon-tile shrink-0"><Eye className="h-5 w-5" /></span>
          <div>
            <span className="section-kicker">Compromissos de transparência</span>
            <h2 className="mt-2 text-xl font-extrabold text-[#172033] sm:text-2xl">O que você pode esperar da versão pública.</h2>
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {compromissos.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-6 text-[#657089]">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#f36a10]" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section data-transparency-links className="overflow-hidden rounded-[1.5rem] bg-[#1f2e6e] text-white shadow-[0_20px_50px_rgba(31,46,110,0.15)]">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="p-5 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffc39a]"><FileText className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffc39a]">Confira as regras completas</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-0.035em] sm:text-2xl">Transparência também significa poder conferir.</h2>
              <p className="mt-3 text-sm leading-6 text-[#dce3f4] sm:text-base sm:leading-7">Veja como o acompanhamento funciona, como tratamos dados pessoais e quais são as regras de uso da plataforma.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Link to="/metodologia" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#1f2e6e] transition hover:bg-[#f4f6fb]">Como funciona <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/privacidade" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">Privacidade</Link>
            <Link to="/termos" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">Termos de uso</Link>
          </div>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-[#7b8599]">O FISCALIZE não é serviço de emergência e não garante, por si só, a solução de um problema por órgão público ou terceiro.</p>
    </div>
  );
}
