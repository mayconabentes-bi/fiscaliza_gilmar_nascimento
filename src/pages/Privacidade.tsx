import { useEffect, useState } from "react";
import { CheckCircle2, Download, Eye, FileText, Info, Lock, Shield, Trash2, TriangleAlert } from "lucide-react";

export default function Privacidade() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [privacyContact, setPrivacyContact] = useState("");
  const [privacyNoticeVersion, setPrivacyNoticeVersion] = useState("2026-09-v2");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    fetch('/api/public-config').then(r => r.json()).then(data => {
      setPrivacyContact(String(data.privacyContact || ''));
      setPrivacyNoticeVersion(String(data.privacyNoticeVersion || '2026-09-v2'));
    }).catch(() => undefined);
  }, []);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/exportar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível exportar seus dados.");
      const blob = new Blob([JSON.stringify(data.dados, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados-pulso.json";
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage("Seus dados foram exportados.");
    } catch (error: any) {
      setMessage(error.message || "Não foi possível exportar seus dados.");
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Quer solicitar a exclusão da sua conta? Alguns dados podem precisar ser mantidos quando houver obrigação legal ou necessidade de preservação de registros.") ) return;
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/excluir", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível solicitar a exclusão.");
      localStorage.removeItem("user");
      window.location.href = "/";
    } catch (error: any) {
      setMessage(error.message || "Não foi possível solicitar a exclusão.");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto py-10">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4"><Shield className="w-9 h-9 text-emerald-700" /><h1 className="text-4xl font-bold text-slate-950">Privacidade no FISCALIZE</h1></div>
        <p className="text-lg text-slate-600 max-w-3xl">Política de Privacidade · versão {privacyNoticeVersion}. Esta página explica quais dados tratamos, para quais finalidades e quais escolhas você tem.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5 flex items-center gap-2"><Lock className="w-5 h-5 text-emerald-700" /> Quem trata seus dados</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>O FISCALIZE é uma iniciativa cívica privada e independente de Maycon Bentes. Para a operação desta plataforma, Maycon Bentes atua como responsável pelas decisões sobre as finalidades e os meios de tratamento dos dados pessoais.</p>
              <p>O FISCALIZE não integra nem representa Prefeitura de Manaus, Câmara Municipal de Manaus, Governo do Amazonas, partido político, mandato ou órgão público.</p>
              {privacyContact ? <p><strong>Canal de privacidade:</strong> <a className="font-bold underline" href={`mailto:${privacyContact}`}>{privacyContact}</a>.</p> : <p className="text-amber-800"><strong>Canal de privacidade ainda não configurado.</strong> A abertura pública ampla não deve ocorrer enquanto esse canal não estiver definido no ambiente de produção.</p>}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5">Quais informações usamos</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p><strong>Demandas:</strong> nome, bairro/localidade, município, categoria, descrição, contato opcional, protocolo e histórico do acompanhamento.</p>
              <p><strong>Faixa etária:</strong> para participação ativa, tratamos apenas uma declaração de faixa etária: menos de 16 anos, 16 a 17 anos ou 18 anos ou mais. Não solicitamos, como padrão, data completa de nascimento, documento de identidade ou biometria para essa finalidade.</p>
              <p><strong>Evidências:</strong> quando você optar por enviar foto, o arquivo pode ser armazenado para documentar o problema. Evite fotografar pessoas identificáveis, crianças, documentos, placas de veículos ou outros dados pessoais desnecessários.</p>
              <p><strong>Conta:</strong> quando o cadastro estiver habilitado, podemos tratar nome, e-mail, município, bairro, faixa etária, status da conta e credenciais protegidas por hash.</p>
              <p><strong>Métricas agregadas:</strong> o sistema mede eventos de uso, origem e ação de acesso de forma agregada. Infraestrutura e provedores também podem gerar logs técnicos de segurança e operação.</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5">Participação de adolescentes</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>A participação autônoma para criar conta e registrar demandas começa aos 16 anos. Pessoas com menos de 16 anos podem consultar conteúdo público, mas não devem criar conta nem enviar demanda de forma autônoma.</p>
              <p>Participantes de 16 e 17 anos recebem proteção reforçada. Registros podem passar por revisão humana mais restrita quando houver fotos, dados de saúde, violência, risco ou identificação de terceiros.</p>
              <p>Dados de adolescentes não podem ser usados para perfilamento político, propaganda eleitoral, segmentação individual ou inferência de preferência política.</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5">Finalidades e limites</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>Usamos os dados necessários para registrar, proteger, organizar e acompanhar relatos; permitir consulta por protocolo; prevenir abuso; manter segurança; aplicar proteção etária adequada; e produzir métricas agregadas sobre funcionamento e participação.</p>
              <p>Aplicamos minimização e evitamos pedir dados sensíveis. Não pedimos preferência política, religião, saúde, raça, etnia, orientação sexual, vida sexual, renda ou biometria para classificar participantes.</p>
              <p>Se dados sensíveis ou dados de terceiros forem enviados incidentalmente em texto ou imagem, eles podem ser restringidos, anonimizados ou removidos quando não forem necessários para a finalidade cívica.</p>
              <p><strong>Seu relato não vira perfil político:</strong> uma demanda cívica não autoriza inclusão automática em lista eleitoral, propaganda política individualizada, pontuação de intenção de voto ou inferência de apoio partidário.</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5">Bases legais, fornecedores e retenção</h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
              <p>O tratamento se apoia nas hipóteses da LGPD aplicáveis a cada operação concreta, incluindo procedimentos solicitados pelo próprio titular, legítimo interesse quando devidamente avaliado, consentimento quando necessário e cumprimento de obrigações legais.</p>
              <p>Serviços de hospedagem, banco de dados, backup, segurança e infraestrutura podem atuar como fornecedores do projeto. Eles devem receber apenas os dados necessários para a prestação contratada e ficam sujeitos aos controles aplicáveis.</p>
              <p>Os dados não devem ser mantidos indefinidamente. A retenção considera a necessidade do acompanhamento, segurança, histórico, prevenção de abuso, proteção reforçada quando aplicável e obrigações legais.</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-950 mb-5 flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-700" /> Seus direitos</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl"><h3 className="font-bold flex gap-2"><Eye className="w-4 h-4" /> Acesso e confirmação</h3><p className="text-sm text-slate-600 mt-2">Você pode pedir confirmação de tratamento e acesso às informações associadas a você.</p></div>
              <div className="p-4 bg-slate-50 rounded-2xl"><h3 className="font-bold flex gap-2"><CheckCircle2 className="w-4 h-4" /> Correção</h3><p className="text-sm text-slate-600 mt-2">Você pode pedir correção de dados inexatos, incompletos ou desatualizados.</p></div>
              <div className="p-4 bg-slate-50 rounded-2xl"><h3 className="font-bold flex gap-2"><Download className="w-4 h-4" /> Cópia</h3><p className="text-sm text-slate-600 mt-2">Quando tecnicamente disponível, você pode obter cópia dos dados vinculados à sua conta.</p></div>
              <div className="p-4 bg-slate-50 rounded-2xl"><h3 className="font-bold flex gap-2"><Trash2 className="w-4 h-4" /> Exclusão e oposição</h3><p className="text-sm text-slate-600 mt-2">Você pode solicitar exclusão, anonimização ou oposição quando cabível, observadas hipóteses legais de conservação.</p></div>
            </div>
          </section>

          <section className="bg-indigo-50 border border-indigo-100 rounded-3xl p-7">
            <h2 className="font-bold text-indigo-950">Participar não significa apoiar</h2>
            <p className="mt-2 text-sm leading-relaxed text-indigo-900">Usar o FISCALIZE ou enviar uma demanda não significa apoiar Maycon Bentes, partido ou candidatura. Eventual atividade político-eleitoral futura deverá utilizar finalidade, base e controles próprios, separados da base cívica.</p>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-400" /> Seus dados</h3>
            {!user ? <p className="text-slate-400 text-sm">Se você usa apenas protocolo sem conta, utilize o canal de privacidade informado nesta página para exercer seus direitos. Usuários autenticados também podem usar as opções abaixo quando disponíveis.</p> : (
              <div className="space-y-3">
                <button onClick={handleExport} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold"><Download className="w-4 h-4" /> Baixar meus dados</button>
                <button onClick={handleDelete} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 py-3 rounded-xl font-bold"><Trash2 className="w-4 h-4" /> Pedir exclusão</button>
                {message && <div className="p-3 bg-white/10 text-xs rounded-lg flex gap-2"><Info className="w-4 h-4 shrink-0" /> {message}</div>}
              </div>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5">
            <h3 className="text-amber-900 font-bold flex items-center gap-2"><TriangleAlert className="w-4 h-4" /> Segurança e incidentes</h3>
            <p className="text-xs text-amber-800 mt-2">Adotamos controles de acesso, limitação de requisições e medidas técnicas proporcionais aos riscos. Incidentes relevantes devem ser avaliados e tratados conforme a regulamentação vigente, inclusive quanto à eventual comunicação à ANPD e aos titulares.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
