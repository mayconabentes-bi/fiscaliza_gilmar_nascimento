import { Link } from "react-router-dom";
import { Activity, ArrowRight, BookOpen, FileCheck2, MapPinned, ShieldCheck, Waypoints } from "lucide-react";

const blocos = [
  {
    icon: MapPinned,
    titulo: "Você registra o problema",
    texto: "Pedimos apenas o necessário para entender o caso: local, categoria, descrição e, se você quiser, uma foto ou contato."
  },
  {
    icon: FileCheck2,
    titulo: "O registro entra como recebido",
    texto: "Depois do envio, a demanda recebe um protocolo e começa como Recebido. A partir daí, pode seguir para Em triagem e Em análise."
  },
  {
    icon: Activity,
    titulo: "O andamento pode mudar",
    texto: "Conforme o caso evolui, o registro pode aparecer como Encaminhado, Em andamento, Concluído ou Encerrado. Nem toda demanda passa por todas as etapas."
  },
  {
    icon: Waypoints,
    titulo: "As mudanças ficam no histórico",
    texto: "Cada atualização relevante entra no histórico com data e status. A consulta pública mostra apenas as informações necessárias para acompanhar o protocolo."
  },
  {
    icon: ShieldCheck,
    titulo: "Evidências e dados pessoais ficam protegidos",
    texto: "Fotos enviadas como evidência ficam em área privada e não aparecem na consulta pública. O relato também não é usado para inferir preferência política ou intenção de voto."
  },
  {
    icon: BookOpen,
    titulo: "Registramos o que foi confirmado",
    texto: "Quando houver resultado, encerramento ou nova informação, o registro pode ser atualizado. O histórico deve refletir apenas o que foi efetivamente confirmado."
  }
];

export default function Metodologia() {
  return (
    <div className="mx-auto max-w-5xl py-2 sm:py-8">
      <header className="grid gap-7 border-b border-[#dde4ef] pb-9 lg:grid-cols-[1fr_0.55fr] lg:items-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2"><span className="section-kicker rounded-full border border-[#d7e0f2] bg-white px-3 py-1.5">FISCALIZE · Como funciona</span><span className="inline-flex rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b84405]">Do relato ao histórico</span></div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Do registro ao acompanhamento por protocolo.</h1>
          <p className="mt-4 text-sm leading-7 text-[#657089] sm:text-base">O FISCALIZE organiza cada relato em etapas de acompanhamento. Os status mostram o andamento do registro e não significam, por si só, que um órgão público adotou determinada providência.</p>
        </div>
        <div className="rounded-2xl bg-[#1f2e6e] p-5 text-white"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffcaa6]">Você cuidando da cidade</p><p className="mt-2 text-sm leading-6 text-[#dce3f4]">O objetivo é deixar claro o que foi registrado, quando houve atualização e qual é o histórico disponível para consulta.</p></div>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {blocos.map(({ icon: Icon, titulo, texto }, index) => (
          <section key={titulo} className="surface-card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4"><span className="icon-tile"><Icon className="h-5 w-5" /></span><span className="text-sm font-extrabold text-[#f36a10]">0{index + 1}</span></div>
            <h2 className="mt-5 text-xl font-extrabold tracking-[-0.025em] text-[#172033]">{titulo}</h2>
            <p className="mt-3 text-sm leading-7 text-[#657089]">{texto}</p>
          </section>
        ))}
      </div>

      <section className="mt-7 overflow-hidden rounded-[1.5rem] bg-[#1f2e6e] text-white shadow-[0_20px_50px_rgba(31,46,110,0.15)]">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-2xl"><h2 className="text-2xl font-extrabold tracking-[-0.035em]">Uma regra importante</h2><p className="mt-3 text-sm leading-7 text-[#dce3f4] sm:text-base">O protocolo do FISCALIZE é um código interno de acompanhamento. Ele não substitui protocolo, chamado, denúncia ou requerimento feito diretamente perante o órgão público competente.</p></div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row lg:mt-0 lg:flex-col"><Link to="/demandas/nova" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f36a10] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#b84405]">Registrar ocorrência <ArrowRight className="h-4 w-4" /></Link><Link to="/protocolo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">Acompanhar protocolo</Link></div>
        </div>
      </section>
    </div>
  );
}
