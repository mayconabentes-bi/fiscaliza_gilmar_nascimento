import { Link } from "react-router-dom";
import { Activity, ArrowRight, FileCheck2, MapPinned, ShieldCheck, Waypoints } from "lucide-react";

const etapas = [
  {
    icon: MapPinned,
    titulo: "Registre o problema",
    texto: "Informe onde está o problema, escolha a categoria e descreva o que aconteceu. Fotos e contato são opcionais."
  },
  {
    icon: FileCheck2,
    titulo: "Receba o protocolo",
    texto: "Depois do envio, o FISCALIZE gera um código para você consultar o registro sem precisar entrar na conta."
  },
  {
    icon: Activity,
    titulo: "Acompanhe as atualizações",
    texto: "Quando o acompanhamento mudar de situação, a nova atualização aparece no histórico com data e status."
  },
  {
    icon: ShieldCheck,
    titulo: "Seus dados ficam protegidos",
    texto: "A consulta pública mostra somente o necessário para acompanhar o registro. Contato, fotos, descrição detalhada e informações internas permanecem protegidos."
  }
];

const statusResumo = [
  ["Recebido", "O registro entrou no FISCALIZE."],
  ["Em triagem", "O registro está sendo organizado para acompanhamento."],
  ["Em análise", "O registro está em análise dentro do FISCALIZE."],
  ["Encaminhado", "Há um encaminhamento registrado no FISCALIZE. Isso não significa protocolo ou aceite automático por órgão público."],
  ["Em andamento", "O acompanhamento está marcado como em andamento no FISCALIZE."],
  ["Concluído", "O acompanhamento foi marcado como concluído no FISCALIZE. Isso não substitui eventual confirmação do órgão responsável."],
  ["Encerrado", "O acompanhamento foi encerrado e o histórico permanece disponível."]
];

export default function Metodologia() {
  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-8">
      <header className="grid gap-5 border-b border-[#dde4ef] pb-7 sm:gap-7 sm:pb-9 lg:grid-cols-[1fr_0.55fr] lg:items-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5">FISCALIZE · Como funciona</span>
            <span className="hidden rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b84405] sm:inline-flex">Registro → protocolo → histórico</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl">Entenda o caminho do seu registro.</h1>
          <p className="mt-3 text-sm leading-6 text-[#657089] sm:mt-4 sm:text-base sm:leading-7">Você registra um problema, recebe um protocolo e acompanha as atualizações pelo FISCALIZE. Os status mostram o que foi registrado na plataforma e não significam, por si só, que um órgão público adotou determinada providência.</p>
        </div>
        <div className="hidden rounded-2xl bg-[#1f2e6e] p-5 text-white sm:block">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffcaa6]">Você cuidando da cidade</p>
          <p className="mt-2 text-sm leading-6 text-[#dce3f4]">A metodologia separa o que foi informado pelo cidadão, o que foi atualizado no FISCALIZE e o que depende de confirmação externa.</p>
        </div>
      </header>

      <section data-methodology-flow className="mt-6 sm:mt-8">
        <div className="mb-4">
          <span className="section-kicker">Como funciona</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-[#172033]">Em quatro passos.</h2>
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {etapas.map(({ icon: Icon, titulo, texto }, index) => (
            <article key={titulo} className="surface-card p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="icon-tile shrink-0"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-extrabold text-[#f36a10]">0{index + 1}</span>
                <h3 className="text-base font-extrabold text-[#172033] sm:text-lg">{titulo}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#657089]">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section data-methodology-status className="surface-card mt-6 p-4 sm:mt-7 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="icon-tile shrink-0"><Waypoints className="h-5 w-5" /></span>
          <div>
            <span className="section-kicker">O que os status querem dizer</span>
            <h2 className="mt-2 text-xl font-extrabold text-[#172033] sm:text-2xl">Situação do acompanhamento no FISCALIZE.</h2>
            <p className="mt-2 text-sm leading-6 text-[#657089]">Nem todo registro passa por todas as situações. O histórico guarda as mudanças que forem efetivamente registradas.</p>
          </div>
        </div>

        <dl className="mt-5 divide-y divide-[#eef2fb] sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          {statusResumo.map(([status, explicacao]) => (
            <div key={status} className="py-3 sm:border-t sm:border-[#eef2fb] sm:py-4">
              <dt className="text-sm font-extrabold text-[#172033]">{status}</dt>
              <dd className="mt-1 text-xs leading-5 text-[#657089] sm:text-sm sm:leading-6">{explicacao}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-methodology-limit className="mt-6 overflow-hidden rounded-[1.5rem] bg-[#1f2e6e] text-white shadow-[0_20px_50px_rgba(31,46,110,0.15)] sm:mt-7">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="p-5 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <h2 className="text-xl font-extrabold tracking-[-0.035em] sm:text-2xl">O protocolo é do FISCALIZE.</h2>
            <p className="mt-3 text-sm leading-6 text-[#dce3f4] sm:text-base sm:leading-7">Ele serve para acompanhar o registro dentro da plataforma. Não substitui protocolo, chamado, denúncia ou requerimento feito diretamente perante o órgão público competente.</p>
            <p className="mt-2 text-xs leading-5 text-[#bfc9df]">O FISCALIZE também não é serviço de emergência. Em situação urgente, procure o serviço público competente.</p>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:mt-0 lg:flex-col">
            <Link to="/demandas/nova" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f36a10] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#b84405]">Registrar problema <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/protocolo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">Consultar protocolo</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
