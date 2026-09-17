import { Activity, BookOpen, FileCheck2, MapPinned, ShieldCheck, Waypoints } from "lucide-react";

const blocos = [
  {
    icon: MapPinned,
    titulo: "1. Você registra o problema",
    texto: "Pedimos apenas o necessário para entender o caso: local, categoria, descrição e, se você quiser, uma foto ou contato."
  },
  {
    icon: FileCheck2,
    titulo: "2. O registro entra como recebido",
    texto: "Depois do envio, a demanda recebe um protocolo e começa como Recebido. A partir daí, pode seguir para Em triagem e Em análise."
  },
  {
    icon: Activity,
    titulo: "3. O andamento pode mudar",
    texto: "Conforme o caso evolui, o registro pode aparecer como Encaminhado, Em andamento, Concluído ou Encerrado. Nem toda demanda passa por todas as etapas."
  },
  {
    icon: Waypoints,
    titulo: "4. As mudanças ficam no histórico",
    texto: "Cada atualização relevante entra no histórico com data e status. A consulta pública mostra apenas as informações necessárias para acompanhar o protocolo."
  },
  {
    icon: ShieldCheck,
    titulo: "5. Evidências e dados pessoais ficam protegidos",
    texto: "Fotos enviadas como evidência ficam em área privada e não aparecem na consulta pública. O relato também não é usado para inferir preferência política ou intenção de voto."
  },
  {
    icon: BookOpen,
    titulo: "6. Registramos o que foi confirmado",
    texto: "Quando houver resultado, encerramento ou nova informação, o registro pode ser atualizado. O histórico deve refletir apenas o que foi efetivamente confirmado."
  }
];

export default function Metodologia() {
  return (
    <div className="max-w-5xl mx-auto py-10">
      <header className="max-w-3xl mb-10">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Como funciona</span>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Do registro ao acompanhamento por protocolo.</h1>
        <p className="mt-4 text-lg text-slate-600">O FISCALIZE organiza cada relato em etapas de acompanhamento. Os status mostram o andamento do registro e não significam, por si só, que um órgão público adotou determinada providência.</p>
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
        <p className="mt-3 text-slate-300 leading-relaxed">O protocolo do FISCALIZE é um código interno de acompanhamento. Ele não substitui protocolo, chamado, denúncia ou requerimento feito diretamente perante o órgão público competente.</p>
      </section>
    </div>
  );
}
