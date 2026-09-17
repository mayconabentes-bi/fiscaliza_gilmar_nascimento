import { AlertTriangle, FileText, Scale, ShieldCheck } from "lucide-react";

export default function Termos() {
  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <header className="mb-8">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Termos de uso · versão 2026-09-P0E</span>
        <h1 className="mt-3 text-4xl font-bold text-slate-950">Regras para usar o FISCALIZE.</h1>
        <p className="mt-4 text-slate-600">O FISCALIZE foi criado por Maycon A. Bentes, com Co-Fundação/Criação de Thauã Malinowski e apoio de Arthur Azevedo, e é disponibilizado para uso do vereador Gilmar Nascimento. Estes termos explicam a finalidade do serviço, seus limites e as responsabilidades de quem o utiliza.</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-700" /> Natureza do serviço</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>O FISCALIZE recebe e organiza relatos sobre problemas urbanos e permite acompanhar registros por um código interno.</p>
          <p>O FISCALIZE não é um canal oficial da Prefeitura de Manaus, da Câmara Municipal de Manaus ou do Governo do Amazonas. O uso pelo vereador Gilmar Nascimento não transforma a plataforma em sistema oficial desses órgãos.</p>
          <p>O protocolo emitido pelo FISCALIZE é interno e não substitui protocolo, denúncia, chamado ou requerimento feito perante órgão público competente.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-700" /> Limites do serviço</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>O FISCALIZE pode registrar, organizar, conferir, encaminhar e acompanhar informações, mas não garante solução por órgão público ou terceiro.</p>
          <p>Quando houver encaminhamento, o histórico deve indicar o que efetivamente ocorreu. O FISCALIZE não deve apresentar como resposta oficial uma etapa que não tenha sido confirmada pelo órgão competente.</p>
          <p>O serviço pode ser alterado, suspenso ou indisponibilizado temporariamente por manutenção, segurança ou evolução do projeto.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold">Faixa etária e participação</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>A participação autônoma para criar conta e registrar demandas está disponível a partir de 16 anos.</p>
          <p>Pessoas com menos de 16 anos podem acessar o conteúdo público, mas não devem criar conta nem registrar demanda de forma autônoma.</p>
          <p>Participantes de 16 e 17 anos recebem proteção reforçada. O FISCALIZE solicita apenas a faixa etária, sem exigir como padrão data completa de nascimento, documento de identidade ou biometria.</p>
          <p>A faixa etária serve exclusivamente para aplicar proteção adequada e não pode ser usada para perfilamento político, propaganda eleitoral ou inferência de preferência.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold">Conteúdo enviado pelo usuário</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>Envie apenas informações necessárias para explicar o problema. Evite expor documentos, dados pessoais de terceiros, crianças, placas de veículos, prontuários, informações íntimas ou outros elementos sem necessidade.</p>
          <p>Não envie ameaças, conteúdo ilegal, material que viole direitos de terceiros ou acusações apresentadas deliberadamente como fato quando você não tiver elementos para sustentá-las.</p>
          <p>Registros podem ser submetidos a triagem e moderação antes de qualquer publicação ou divulgação. Conteúdo pode ser ocultado, resumido, anonimizado ou removido para proteger pessoas e cumprir obrigações legais.</p>
          <p>Registros de participantes de 16 e 17 anos podem ser submetidos a revisão reforçada, especialmente quando houver fotos, dados de saúde, violência, risco ou identificação de terceiros.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold">Emergências, crimes e riscos imediatos</h2>
        <p className="mt-3 text-slate-600 leading-relaxed">O FISCALIZE não é serviço de emergência, polícia, saúde, defesa civil ou canal oficial de denúncia. Situações de risco imediato, crimes em andamento, emergência médica ou ameaça à integridade física devem ser levadas diretamente aos serviços e autoridades competentes.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-700" /> Participação cívica e política</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>Usar o FISCALIZE, registrar uma demanda, fornecer informação ou consultar um protocolo não significa apoiar qualquer pessoa, partido ou candidatura.</p>
          <p>Dados fornecidos para finalidade cívica não devem ser reutilizados automaticamente para propaganda eleitoral, lista de campanha, classificação individual de preferência política ou inferência de intenção de voto.</p>
          <p>Dados de adolescentes têm proteção reforçada e não podem ser utilizados para segmentação eleitoral ou construção de perfis políticos.</p>
          <p>Qualquer tratamento de dados para finalidade diferente da finalidade cívica deverá ter fundamento, finalidade e controles próprios, observando a legislação aplicável.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-7">
        <h2 className="text-xl font-bold">Privacidade e segurança</h2>
        <div className="mt-3 space-y-3 text-slate-600 leading-relaxed">
          <p>O tratamento de dados pessoais é detalhado na Política de Privacidade. Para os dados das demandas, Gilmar Nascimento atua como controlador.</p>
          <p>O usuário pode consultar os canais e direitos disponíveis naquela página. Medidas técnicas e administrativas são adotadas de forma proporcional aos riscos, sem promessa de segurança absoluta.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
        <h2 className="text-xl font-bold text-amber-950 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Evolução e revisão</h2>
        <p className="mt-3 text-sm text-amber-900 leading-relaxed">Estes termos podem ser atualizados quando houver mudança relevante de funcionalidade, tratamento de dados ou obrigação legal. Mudanças materiais devem ser identificadas por nova versão e comunicadas de forma adequada.</p>
      </section>
    </div>
  );
}
