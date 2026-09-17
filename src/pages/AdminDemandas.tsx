import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

const statusOptions = [
  "RECEBIDA",
  "EM_TRIAGEM",
  "ENCAMINHADA",
  "EM_ANALISE",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "INDEFERIDA"
];

const prioridadeClass: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-blue-50 text-blue-700",
  ALTA: "bg-amber-50 text-amber-700",
  CRITICA: "bg-red-50 text-red-700"
};

export default function AdminDemandas() {
  const [demandas, setDemandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [error, setError] = useState("");

  const fetchDemandas = async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (municipio) params.set("municipio", municipio);
    if (categoria) params.set("categoria", categoria);

    try {
      const response = await fetch(`/api/admin/demandas?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar demandas.");
      setDemandas(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar demandas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizarStatus = async (demanda: any) => {
    const novoStatus = prompt("Novo status", demanda.status);
    if (!novoStatus || !statusOptions.includes(novoStatus)) {
      alert("Status inválido. Use um dos status exibidos no filtro.");
      return;
    }
    const observacao = prompt("Observação interna sobre a atualização", "");

    const response = await fetch(`/api/admin/demandas/${demanda.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus, observacao_interna: observacao })
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Erro ao atualizar demanda.");
      return;
    }

    fetchDemandas();
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600" /> Triagem de demandas
          </h1>
          <p className="mt-2 text-slate-600">Painel operacional para priorização, encaminhamento e atualização de status.</p>
        </div>
        <button onClick={fetchDemandas} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 shadow-sm">
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Filtrar município" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Filtrar categoria" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={fetchDemandas} className="rounded-xl bg-slate-900 px-4 py-2 text-white text-sm font-semibold hover:bg-slate-800">Aplicar filtros</button>
      </div>

      {error && <div className="mb-6 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Protocolo</th>
                <th className="px-4 py-3 font-semibold">Território</th>
                <th className="px-4 py-3 font-semibold">Categoria</th>
                <th className="px-4 py-3 font-semibold">Prioridade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Carregando demandas...</td></tr>
              ) : demandas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhuma demanda encontrada.</td></tr>
              ) : demandas.map(demanda => (
                <tr key={demanda.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-4 font-mono font-semibold text-slate-900">{demanda.protocolo}</td>
                  <td className="px-4 py-4 text-slate-700">{demanda.municipio}<br /><span className="text-xs text-slate-400">{demanda.bairro || "Sem bairro"}</span></td>
                  <td className="px-4 py-4 text-slate-700">{demanda.categoria}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${prioridadeClass[demanda.prioridade] || prioridadeClass.MEDIA}`}>{demanda.prioridade}</span></td>
                  <td className="px-4 py-4 text-slate-700 font-semibold">{demanda.status}</td>
                  <td className="px-4 py-4 text-slate-600 max-w-md line-clamp-3">{demanda.descricao}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => atualizarStatus(demanda)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Alterar status</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
