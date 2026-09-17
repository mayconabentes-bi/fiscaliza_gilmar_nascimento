import { Eye, ShieldCheck, UserRound, Waypoints } from "lucide-react";

const pilares = [
  {
    icon: UserRound,
    titulo: "Origem e uso",
    texto: "O FISCALIZE tem como Fundador/Criador Maycon A. Bentes e como Co-Fundador/Criador Thauã Malinowski, com apoio de Arthur Azevedo. A plataforma é disponibilizada para uso do vereador Gilmar Nascimento no registro e acompanhamento de demandas. O FISCALIZE não substitui canais oficiais nem garante, por si só, a solução de um problema."
  },
  {
    icon: Waypoints,
    titulo: "Como funciona",
    texto: "Cada registro recebe um protocolo e pode ser organizado por território, tema, prioridade e andamento para facilitar a leitura dos problemas recorrentes."
  },
  {
    icon: ShieldCheck,
    titulo: "Participar não significa apoiar",
    texto: "Registrar um problema ou acompanhar um protocolo não cria vínculo de apoio pessoal, político ou eleitoral. A participação é livre."
  },
  {
    icon: Eye,
    titulo: "Resultados com contexto",
    texto: "Quando houver atualização ou resultado, o FISCALIZE registra o que foi confirmado, a data e, quando houver, a existência de evidências verificadas, sem expor conteúdo privado nem atribuir a si ações que não realizou."
  }
];

export default function Transparencia() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 py-2 sm:py-8">
      <header className="surface-card overflow-hidden">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2"><span className="section-kicker rounded-full border border-[#d7e0f2] bg-[#f7f9fd] px-3 py-1.5">Sobre o FISCALIZE</span><span className="inline-flex rounded-full bg-[#fff0e5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b84405]">Você cuidando da cidade</span></div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Um espaço para registrar, organizar e acompanhar problemas relatados em Manaus.</h1>
            <p className="mt-4 text-sm leading-7 text-[#657089] sm:text-base">Aqui você encontra informações diretas sobre a origem da plataforma, como os registros são tratados e quais são os limites do serviço.</p>
          </div>
          <div className="flex justify-start lg:justify-end"><span className="brand-signature-mark brand-signature-mark--footer" aria-hidden="true"><img src="/brand/gilmar-nascimento-oficial.png" alt="" /></span></div>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {pilares.map(({ icon: Icon, titulo, texto }, index) => (
          <section key={titulo} className="surface-card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4"><span className="icon-tile"><Icon className="h-5 w-5" /></span><span className="text-sm font-extrabold text-[#f36a10]">0{index + 1}</span></div>
            <h2 className="mt-5 text-xl font-extrabold tracking-[-0.025em] text-[#172033]">{titulo}</h2>
            <p className="mt-3 text-sm leading-7 text-[#657089]">{texto}</p>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-[1.5rem] bg-[#1f2e6e] text-white shadow-[0_20px_50px_rgba(31,46,110,0.15)]">
        <div className="h-1.5 bg-[#f36a10]" aria-hidden="true" />
        <div className="flex items-start gap-4 p-6 sm:p-8"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#ffc39a]"><Eye className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ffc39a]">Transparência</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em]">Quando publicarmos resultados</h2><p className="mt-3 text-sm leading-7 text-[#dce3f4] sm:text-base">Vamos mostrar a fonte, o período e a situação do caso sempre que isso for importante para entender o resultado. Exemplos serão identificados como exemplos.</p></div></div>
      </section>
    </div>
  );
}
