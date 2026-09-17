import { Activity, BookOpen, FileCheck2, MapPinned, ShieldCheck, Waypoints } from "lucide-react";

const blocos = [
  {
    icon: MapPinned,
    titulo: "1. Você registra o problema",
    texto: "Pedimos só o que ajuda a entender o caso: onde aconteceu, qual é o problema, uma descrição e, se você quiser, uma foto ou contato."
  },
  {
    icon: FileCheck2,
    titulo: "2. Conferimos as informações",
    texto: "Quando houver foto, documento, protocolo ou outra evidência verificável, usamos essas informações para compreender melhor o que foi relatado."
  },
  {
    icon: Activity,
    titulo: "3. Atualizamos o andamento",
    texto: "Seu registro pode passar por etapas como recebido, em análise, em acompanhamento e concluído. Você acompanha isso pelo protocolo."
  },
  {
    icon: Waypoints,
    titulo: "4. Registramos o que aconteceu",
    texto: "Quando houver uma mudança relevante, ela entra no histórico com data e contexto. O FISCALIZE não assume como própria uma ação que não realizou."
  },
  {
    icon: ShieldCheck,
    titulo: "5. Seu registro não vira perfil político",
    texto: "As informações da demanda são usadas para entender e acompanhar o problema. Não usamos o seu relato para classificar preferência política ou intenção de voto."
  },
  {
    icon: BookOpen,
    titulo: "6. Corrigimos quando necessário",
    texto: "Se aparecer uma informação melhor, o registro pode ser atualizado. Mudanças importantes ficam anotadas para que o histórico continue claro."
  }
];

export default function Metodologia() {
  return (
    <div className="max-w-5xl mx-auto py-10">
      <header className="max-w-3xl mb-10">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Como funciona</span>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">O que acontece depois que você envia um problema.</h1>
        <p className="mt-4 text-lg text-slate-600">A ideia é simples: receber seu relato, conferir o que for possível, registrar mudanças relevantes e deixar o andamento visível para você.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {blocos.map(({ icon: Icon, titulo, texto }) => (
          <section key={titulo} className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
            <h2 className="mt-5 text-xl font-bold text-slate-950">{titulo}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{texto}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-3xl bg-slate-950 text-white p-8">
        <h2 className="text-2xl font-bold">Uma regra importante</h2>
        <p className="mt-3 text-slate-300 leading-relaxed">O histórico deve refletir o que realmente aconteceu. Quando o FISCALIZE apenas registra ou acompanha um resultado, isso fica claro para quem consulta o protocolo.</p>
      </section>
    </div>
  );
}
