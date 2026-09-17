import { Eye, ShieldCheck, UserRound, Waypoints } from "lucide-react";

export default function Transparencia() {
  return (
    <div className="max-w-5xl mx-auto py-10 space-y-8">
      <header className="max-w-3xl">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Sobre o FISCALIZE</span>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Um projeto independente para ouvir e organizar problemas reais.</h1>
        <p className="mt-4 text-lg text-slate-600">Aqui você encontra respostas diretas sobre quem criou o FISCALIZE, como os registros são tratados e quais são os limites do projeto.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-7">
          <UserRound className="w-6 h-6 text-emerald-700" />
          <h2 className="mt-4 text-xl font-bold">Quem criou</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">O FISCALIZE foi criado por Maycon Bentes para ouvir os bairros de Manaus, organizar problemas relatados por moradores e acompanhar cada caso com mais clareza.</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-7">
          <Waypoints className="w-6 h-6 text-emerald-700" />
          <h2 className="mt-4 text-xl font-bold">Como funciona</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">Cada registro recebe um protocolo e pode ser organizado por território, tema, prioridade e andamento para facilitar a leitura dos problemas recorrentes.</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-7">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
          <h2 className="mt-4 text-xl font-bold">Participar não significa apoiar</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">Registrar um problema ou acompanhar um protocolo não cria vínculo de apoio pessoal, político ou eleitoral. A participação é livre e independente.</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-7">
          <Eye className="w-6 h-6 text-emerald-700" />
          <h2 className="mt-4 text-xl font-bold">Resultados com contexto</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">Quando houver atualização ou resultado, o FISCALIZE registra o que foi confirmado, a data e as evidências disponíveis, sem atribuir a si ações que não realizou.</p>
        </section>
      </div>

      <section className="rounded-3xl bg-slate-950 text-white p-8">
        <div className="flex items-start gap-3"><Eye className="w-6 h-6 text-emerald-400 mt-1" /><div><h2 className="text-2xl font-bold">Quando publicarmos resultados</h2><p className="mt-3 text-slate-300 leading-relaxed">Vamos mostrar a fonte, o período e a situação do caso sempre que isso for importante para entender o resultado. Exemplos serão identificados como exemplos.</p></div></div>
      </section>
    </div>
  );
}
