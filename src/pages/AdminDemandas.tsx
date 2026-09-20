import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, Image as ImageIcon, RefreshCw, ShieldCheck, X } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";
import { DEMAND_TAXONOMY, demandCategoryLabel, demandProblemLabel, getDemandCategory } from "../shared/demandTaxonomy";
import { canTransitionDemandStatus, isDemandStatus } from "../shared/demandStatusWorkflow";

const statusOptions = [
  { value: "RECEBIDA", label: "Recebida", description: "Registro recebido e protocolado, aguardando triagem." },
  { value: "EM_TRIAGEM", label: "Em triagem", description: "Registro em avaliação inicial para classificação e priorização." },
  { value: "ENCAMINHADA", label: "Encaminhada", description: "Demanda encaminhada para a área responsável ou fluxo competente." },
  { value: "EM_ANALISE", label: "Em análise", description: "Equipe responsável está analisando o caso e os próximos passos." },
  { value: "EM_EXECUCAO", label: "Em execução", description: "Providências relacionadas à demanda estão em andamento." },
  { value: "CONCLUIDA", label: "Concluída", description: "Tratamento encerrado com providência ou resposta registrada." },
  { value: "INDEFERIDA", label: "Indeferida", description: "Demanda encerrada sem prosseguimento, com justificativa registrada." }
] as const;

type StatusValue = typeof statusOptions[number]["value"];
type PrioridadeValue = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type EvidenciaDecisao = "APROVAR_PRIVADA" | "REQUER_ANONIMIZACAO" | "REJEITAR";

const prioridadeOptions: { value: PrioridadeValue; label: string; description: string }[] = [
  { value: "BAIXA", label: "Baixa", description: "Pode seguir o fluxo normal sem urgência operacional." },
  { value: "MEDIA", label: "Média", description: "Prioridade padrão para tratamento regular." },
  { value: "ALTA", label: "Alta", description: "Requer atenção operacional antecipada." },
  { value: "CRITICA", label: "Crítica", description: "Requer atenção imediata da triagem." },
];

const prioridadeClass: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700",
  MEDIA: "bg-blue-50 text-blue-700",
  ALTA: "bg-amber-50 text-amber-700",
  CRITICA: "bg-red-50 text-red-700"
};

const evidenciaStatusLabel: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADA_PRIVADA: "Aprovada privada",
  REQUER_ANONIMIZACAO: "Requer anonimização",
  REJEITADA: "Rejeitada",
  NAO_ENVIADA: "Sem foto"
};

const evidenciaStatusClass: Record<string, string> = {
  PENDENTE: "bg-amber-50 text-amber-700",
  APROVADA_PRIVADA: "bg-emerald-50 text-emerald-700",
  REQUER_ANONIMIZACAO: "bg-violet-50 text-violet-700",
  REJEITADA: "bg-red-50 text-red-700",
  NAO_ENVIADA: "bg-slate-100 text-slate-500"
};

function statusLabel(value: string) {
  return statusOptions.find(option => option.value === value)?.label || value;
}

function evidenciaLabel(value: string) {
  return evidenciaStatusLabel[value] || value || "Pendente";
}

export default function AdminDemandas() {
  const [demandas, setDemandas] = useState<any[]>([]);
  const [totalDemandas, setTotalDemandas] = useState(0);
  const [listaTruncada, setListaTruncada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") || "");
  const [prioridade, setPrioridade] = useState(() => new URLSearchParams(window.location.search).get("prioridade") || "");
  const [protocolo, setProtocolo] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [bairro, setBairro] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipoProblema, setTipoProblema] = useState("");
  const [error, setError] = useState("");
  const [demandaSelecionada, setDemandaSelecionada] = useState<any | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusValue>("RECEBIDA");
  const [novaPrioridade, setNovaPrioridade] = useState<PrioridadeValue>("MEDIA");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalError, setModalError] = useState("");
  const [evidenciaDemanda, setEvidenciaDemanda] = useState<any | null>(null);
  const [evidencias, setEvidencias] = useState<any[]>([]);
  const [evidenciaIndex, setEvidenciaIndex] = useState(0);
  const [evidenciaLoading, setEvidenciaLoading] = useState(false);
  const [evidenciaError, setEvidenciaError] = useState("");
  const [evidenciaObservacao, setEvidenciaObservacao] = useState("");
  const [moderandoEvidencia, setModerandoEvidencia] = useState(false);
  const listControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const statusAtualLabel = useMemo(
    () => demandaSelecionada ? statusLabel(demandaSelecionada.status) : "",
    [demandaSelecionada]
  );

  const evidenciaAtual = evidencias[evidenciaIndex] || null;
  const evidenciaUrl = String(evidenciaAtual?.url || "");
  const evidenciaMime = String(evidenciaAtual?.mime || "");
  const evidenciaStatusAtual = String(evidenciaAtual?.moderacao_status || evidenciaDemanda?.evidencia_moderacao_status || "PENDENTE");

  const fetchDemandas = async () => {
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;

    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (prioridade) params.set("prioridade", prioridade);
    if (protocolo.trim()) params.set("protocolo", protocolo.trim());
    if (municipio.trim()) params.set("municipio", municipio.trim());
    if (bairro.trim()) params.set("bairro", bairro.trim());
    if (categoria) params.set("categoria", categoria);
    if (tipoProblema) params.set("tipo_problema", tipoProblema);

    try {
      const response = await fetchWithTimeout(
        `/api/admin/demandas?${params.toString()}`,
        { signal: controller.signal, cache: "no-store", credentials: "same-origin" },
        10000
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar demandas.");
      if (!Array.isArray(data?.items) || !Number.isFinite(Number(data?.total))) {
        throw new Error("Resposta inválida ao carregar demandas.");
      }
      const items = data.items;
      if (mountedRef.current && !controller.signal.aborted) {
        setDemandas(items);
        setTotalDemandas(Number(data.total));
        setListaTruncada(data?.truncated === true);
      }
    } catch (err: any) {
      if (controller.signal.aborted || err?.name === "AbortError") return;
      if (mountedRef.current) {
        setDemandas([]);
        setTotalDemandas(0);
        setListaTruncada(false);
        setError(err.message || "Erro ao carregar demandas.");
      }
    } finally {
      if (mountedRef.current && listControllerRef.current === controller) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchDemandas();
    return () => {
      mountedRef.current = false;
      listControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirAlteracaoStatus = (demanda: any) => {
    setDemandaSelecionada(demanda);
    setNovoStatus((statusOptions.some(option => option.value === demanda.status) ? demanda.status : "RECEBIDA") as StatusValue);
    setNovaPrioridade((prioridadeOptions.some(option => option.value === demanda.prioridade) ? demanda.prioridade : "MEDIA") as PrioridadeValue);
    setObservacao("");
    setModalError("");
  };

  const fecharModal = () => {
    if (salvando) return;
    setDemandaSelecionada(null);
    setObservacao("");
    setModalError("");
  };

  const atualizarStatus = async () => {
    if (!demandaSelecionada) return;
    const statusMudou = novoStatus !== demandaSelecionada.status;
    const prioridadeMudou = novaPrioridade !== demandaSelecionada.prioridade;
    if (!statusMudou && !prioridadeMudou) {
      setModalError("Altere o status ou a prioridade antes de salvar.");
      return;
    }
    const encerrandoAgora = statusMudou && ["CONCLUIDA", "INDEFERIDA"].includes(novoStatus);
    if (encerrandoAgora && !observacao.trim()) {
      setModalError("Informe uma justificativa para concluir ou indeferir a demanda.");
      return;
    }

    setSalvando(true);
    setModalError("");
    try {
      const response = await fetchWithTimeout(`/api/admin/demandas/${demandaSelecionada.id}/status`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, prioridade: novaPrioridade, observacao_interna: observacao.trim(), expected_updated_at: demandaSelecionada.updated_at })
      }, 12000);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data?.code === "STALE_DEMAND_VERSION") {
          await fetchDemandas();
          setDemandaSelecionada(null);
          setError("Esta demanda foi alterada por outro operador. A lista foi atualizada; abra novamente a triagem antes de salvar.");
          return;
        }
        throw new Error(data.error || "Erro ao atualizar demanda.");
      }
      setDemandaSelecionada(null);
      setObservacao("");
      await fetchDemandas();
    } catch (err: any) {
      setModalError(err?.name === "AbortError" ? "A atualização demorou além do esperado. Tente novamente." : (err.message || "Erro ao atualizar demanda."));
    } finally {
      setSalvando(false);
    }
  };

  const abrirEvidencia = async (demanda: any) => {
    setEvidenciaDemanda(demanda);
    setEvidencias([]);
    setEvidenciaIndex(0);
    setEvidenciaError("");
    setEvidenciaObservacao("");
    setEvidenciaLoading(true);

    try {
      const response = await fetchWithTimeout(
        `/api/admin/demandas/${demanda.id}/evidencias`,
        { credentials: "same-origin", cache: "no-store" },
        10000
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as evidências.");
      const items = Array.isArray(data.evidencias) ? data.evidencias : [];
      if (!items.length) throw new Error("Nenhuma evidência disponível.");
      setEvidencias(items);
      setEvidenciaIndex(0);
    } catch (err: any) {
      setEvidenciaError(err?.name === "AbortError" ? "As evidências demoraram além do esperado para abrir." : (err.message || "Não foi possível carregar as evidências."));
    } finally {
      setEvidenciaLoading(false);
    }
  };

  const fecharEvidencia = () => {
    if (moderandoEvidencia) return;
    setEvidenciaDemanda(null);
    setEvidencias([]);
    setEvidenciaIndex(0);
    setEvidenciaError("");
    setEvidenciaObservacao("");
  };

  const moderarEvidencia = async (decisao: EvidenciaDecisao) => {
    if (!evidenciaDemanda || !evidenciaAtual) return;
    if (decisao === "REJEITAR" && !window.confirm("Rejeitar esta evidência removerá somente esta foto do armazenamento privado. Deseja continuar?")) return;

    setModerandoEvidencia(true);
    setEvidenciaError("");
    try {
      const endpoint = evidenciaAtual.legacy
        ? `/api/admin/evidencias/${evidenciaDemanda.id}/decisao`
        : `/api/admin/evidencias/item/${evidenciaAtual.id}/decisao`;
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, observacao: evidenciaObservacao.trim() })
      }, 12000);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a decisão sobre a evidência.");
      setEvidenciaDemanda(null);
      setEvidencias([]);
      setEvidenciaIndex(0);
      setEvidenciaObservacao("");
      await fetchDemandas();
    } catch (err: any) {
      setEvidenciaError(err?.name === "AbortError" ? "A moderação demorou além do esperado. Tente novamente." : (err.message || "Não foi possível registrar a decisão sobre a evidência."));
    } finally {
      setModerandoEvidencia(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600" /> Triagem de demandas
          </h1>
          <p className="mt-2 text-slate-600">Painel operacional para priorização, encaminhamento, evidências privadas e atualização de status.</p>
        </div>
        <button onClick={fetchDemandas} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input value={protocolo} onChange={e => setProtocolo(e.target.value.toUpperCase())} placeholder="Buscar protocolo" aria-label="Buscar por protocolo" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm" />
          <input value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Filtrar bairro" aria-label="Filtrar por bairro" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm" />
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filtrar por status" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm">
            <option value="">Todos os status</option>
            {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={prioridade} onChange={e => setPrioridade(e.target.value)} aria-label="Filtrar por prioridade" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm">
            <option value="">Todas as prioridades</option>
            {prioridadeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <input value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Filtrar município" aria-label="Filtrar por município" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm" />
          <select value={categoria} onChange={e => { setCategoria(e.target.value); setTipoProblema(""); }} aria-label="Filtrar por área" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm">
            <option value="">Todas as áreas</option>
            {DEMAND_TAXONOMY.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
          <select value={tipoProblema} onChange={e => setTipoProblema(e.target.value)} aria-label="Filtrar por problema" className="min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm" disabled={!categoria}>
            <option value="">Todos os problemas</option>
            {(getDemandCategory(categoria)?.problems || []).map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
          <button onClick={fetchDemandas} disabled={loading} className="min-h-12 rounded-xl bg-slate-900 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50 sm:text-sm">Aplicar filtros</button>
        </div>
      </div>

      {error && <div className="mb-6 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span><strong className="text-slate-900">{demandas.length}</strong> de <strong className="text-slate-900">{totalDemandas}</strong> registro(s) exibido(s).</span>
          {listaTruncada && <span className="font-semibold text-amber-700">Há mais registros do que o limite atual de 500. Refine os filtros para uma triagem completa.</span>}
        </div>
      )}

      <div className="space-y-3 lg:hidden" data-mobile-triage-cards>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Carregando demandas...</div>
        ) : demandas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Nenhuma demanda encontrada.</div>
        ) : demandas.map(demanda => (
          <article key={demanda.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-bold text-slate-800">{demanda.protocolo}</p>
                <p className="mt-2 text-base font-extrabold text-slate-900">{demandProblemLabel(demanda.categoria, demanda.tipo_problema)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{demandCategoryLabel(demanda.categoria)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${prioridadeClass[demanda.prioridade] || prioridadeClass.MEDIA}`}>{demanda.prioridade}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{statusLabel(demanda.status)}</span>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p><strong className="text-slate-800">Território:</strong> {demanda.bairro || "Sem bairro"} · {demanda.municipio}</p>
              <p className="mt-2 line-clamp-3 leading-5">{demanda.descricao}</p>
            </div>
            {Number(demanda.evidencia_upload_falhas || 0) > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                Falha técnica no envio de evidências: {Number(demanda.evidencia_upload_anexadas || 0)} de {Number(demanda.evidencia_upload_solicitadas || 0)} foto(s) anexada(s). O protocolo foi preservado.
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => abrirAlteracaoStatus(demanda)} className="min-h-12 flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Abrir triagem</button>
              {demanda.tem_evidencia_foto ? (
                <button type="button" onClick={() => abrirEvidencia(demanda)} className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                  Ver {Number(demanda.evidencia_total || 1)} foto{Number(demanda.evidencia_total || 1) === 1 ? "" : "s"} · {evidenciaLabel(demanda.evidencia_moderacao_status)}
                </button>
              ) : (
                <div className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-sm text-slate-400">Sem foto</div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Protocolo</th>
                <th className="px-4 py-3 font-semibold">Território</th>
                <th className="px-4 py-3 font-semibold">Classificação</th>
                <th className="px-4 py-3 font-semibold">Prioridade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold">Evidência</th>
                <th className="min-w-[128px] whitespace-nowrap px-4 py-3 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Carregando demandas...</td></tr>
              ) : demandas.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhuma demanda encontrada.</td></tr>
              ) : demandas.map(demanda => (
                <tr key={demanda.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-4 font-mono font-semibold text-slate-900">{demanda.protocolo}</td>
                  <td className="px-4 py-4 text-slate-700">{demanda.municipio}<br /><span className="text-xs text-slate-400">{demanda.bairro || "Sem bairro"}</span></td>
                  <td className="px-4 py-4 text-slate-700"><span className="font-semibold">{demandProblemLabel(demanda.categoria, demanda.tipo_problema)}</span><br /><span className="text-xs text-slate-400">{demandCategoryLabel(demanda.categoria)}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${prioridadeClass[demanda.prioridade] || prioridadeClass.MEDIA}`}>{demanda.prioridade}</span></td>
                  <td className="px-4 py-4 text-slate-700 font-semibold">{statusLabel(demanda.status)}</td>
                  <td className="px-4 py-4 text-slate-600 max-w-md line-clamp-3">{demanda.descricao}</td>
                  <td className="px-4 py-4">
                    {Number(demanda.evidencia_upload_falhas || 0) > 0 && (
                      <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold leading-4 text-amber-800">
                        Upload incompleto: {Number(demanda.evidencia_upload_anexadas || 0)}/{Number(demanda.evidencia_upload_solicitadas || 0)}
                      </div>
                    )}
                    {demanda.tem_evidencia_foto ? (
                      <div className="flex min-w-36 flex-col items-start gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${evidenciaStatusClass[demanda.evidencia_moderacao_status] || evidenciaStatusClass.PENDENTE}`}>
                          {evidenciaLabel(demanda.evidencia_moderacao_status)}
                        </span>
                        <button onClick={() => abrirEvidencia(demanda)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          <Eye className="h-3.5 w-3.5" /> Ver {Number(demanda.evidencia_total || 1)} foto{Number(demanda.evidencia_total || 1) === 1 ? "" : "s"}
                        </button>
                      </div>
                    ) : <span className="text-xs text-slate-400">Sem foto</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    <button onClick={() => abrirAlteracaoStatus(demanda)} className="inline-flex min-w-[112px] items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Alterar status</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {demandaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="status-modal-title">
          <div className="w-full max-w-2xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Atualização de andamento</p>
                <h2 id="status-modal-title" className="mt-1 text-xl font-extrabold text-slate-900">Atualizar triagem da demanda</h2>
                <p className="mt-1 text-sm text-slate-500">{demandaSelecionada.protocolo} · status atual: <strong>{statusAtualLabel}</strong></p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Território</p><p className="mt-1 text-sm font-semibold text-slate-800">{demandaSelecionada.bairro || "Sem bairro"} · {demandaSelecionada.municipio}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Classificação</p><p className="mt-1 text-sm font-semibold text-slate-800">{demandProblemLabel(demandaSelecionada.categoria, demandaSelecionada.tipo_problema)}</p></div>
                </div>
                <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Descrição completa</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{demandaSelecionada.descricao}</p></div>
              </div>

              <label className="mb-5 block">
                <span className="text-sm font-bold text-slate-800">Prioridade operacional</span>
                <span className="mt-1 block text-xs text-slate-500">Classifique a urgência para organizar a fila de triagem.</span>
                <select
                  value={novaPrioridade}
                  onChange={e => setNovaPrioridade(e.target.value as PrioridadeValue)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm"
                >
                  {prioridadeOptions.map(option => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}
                </select>
              </label>

              <p className="mb-2 text-sm font-bold text-slate-800">Status de andamento</p>
              <div className="space-y-2">
                {statusOptions
                  .filter(option => {
                    if (!isDemandStatus(demandaSelecionada.status) || !isDemandStatus(option.value)) return false;
                    return canTransitionDemandStatus(demandaSelecionada.status, option.value);
                  })
                  .map(option => {
                  const selected = novoStatus === option.value;
                  const current = demandaSelecionada.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNovoStatus(option.value)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                          {selected && <CheckCircle2 className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900">{option.label}</span>
                            {current && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">Atual</span>}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-slate-500">{option.description}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-bold text-slate-800">Observação interna {novoStatus !== demandaSelecionada.status && ["CONCLUIDA", "INDEFERIDA"].includes(novoStatus) ? <strong className="text-red-600">· obrigatória para encerramento</strong> : null}</span>
                <span className="mt-1 block text-xs text-slate-500">Registre o motivo da decisão. Ao concluir ou indeferir, a justificativa é obrigatória e fica na rastreabilidade administrativa.</span>
                <textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Ex.: Demanda validada e encaminhada para análise da equipe responsável."
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-right text-xs text-slate-400">{observacao.length}/2000</span>
              </label>

              {modalError && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{modalError}</div>}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={fecharModal} disabled={salvando} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button
                type="button"
                onClick={atualizarStatus}
                disabled={salvando || (novoStatus === demandaSelecionada.status && novaPrioridade === demandaSelecionada.prioridade)}
                className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar triagem"}
              </button>
            </div>
          </div>
        </div>
      )}

      {evidenciaDemanda && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="evidencia-modal-title">
          <div className="w-full max-w-3xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700"><ImageIcon className="h-4 w-4" /> Evidência privada</p>
                <h2 id="evidencia-modal-title" className="mt-1 text-xl font-extrabold text-slate-900">Revisar foto da demanda</h2>
                <p className="mt-1 text-sm text-slate-500">{evidenciaDemanda.protocolo}</p>
              </div>
              <button type="button" onClick={fecharEvidencia} disabled={moderandoEvidencia} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Moderação:</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${evidenciaStatusClass[evidenciaStatusAtual] || evidenciaStatusClass.PENDENTE}`}>
                  {evidenciaLabel(evidenciaStatusAtual)}
                </span>
                {evidenciaMime && <span className="text-xs text-slate-400">{evidenciaMime}</span>}
                {evidencias.length > 1 && <span className="text-xs font-bold text-slate-500">Foto {evidenciaIndex + 1} de {evidencias.length}</span>}
              </div>

              {evidenciaLoading && <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">Carregando evidência privada...</div>}

              {!evidenciaLoading && evidenciaUrl && (
                <>
                  {evidencias.length > 1 && <div className="mb-3 flex flex-wrap gap-2">
                    {evidencias.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setEvidenciaIndex(index); setEvidenciaObservacao(""); }}
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${index === evidenciaIndex ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
                      >
                        Foto {index + 1}
                      </button>
                    ))}
                  </div>}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                    <img src={evidenciaUrl} alt={`Evidência ${evidenciaIndex + 1} da demanda ${evidenciaDemanda.protocolo}`} onError={() => setEvidenciaError("A imagem não pôde ser exibida. Atualize a evidência ou tente novamente.")} className="mx-auto max-h-[52vh] w-auto max-w-full object-contain" />
                  </div>
                </>
              )}

              {!evidenciaLoading && !evidenciaUrl && !evidenciaError && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhuma imagem disponível.</div>}

              {evidenciaError && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{evidenciaError}</div>}

              {evidenciaUrl && (
                <label className="mt-5 block">
                  <span className="text-sm font-bold text-slate-800">Observação da moderação</span>
                  <span className="mt-1 block text-xs text-slate-500">Use este campo para registrar contexto sobre privacidade, anonimização ou rejeição da imagem.</span>
                  <textarea
                    value={evidenciaObservacao}
                    onChange={e => setEvidenciaObservacao(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Ex.: Imagem adequada para consulta interna; sem exposição pública."
                    className="mt-2 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="mt-1 block text-right text-xs text-slate-400">{evidenciaObservacao.length}/1000</span>
                </label>
              )}

              <p className="mt-4 text-xs leading-relaxed text-slate-500">A foto permanece em armazenamento privado. O acesso exibido nesta tela usa uma URL temporária e não torna a evidência pública.</p>
              {evidenciaStatusAtual === "REQUER_ANONIMIZACAO" && (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold leading-5 text-violet-800">
                  Esta evidência está bloqueada para aprovação até existir uma versão realmente anonimizada. O status não substitui a transformação da imagem.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6">
              <button type="button" onClick={fecharEvidencia} disabled={moderandoEvidencia} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Fechar</button>
              {evidenciaUrl && <>
                <button type="button" onClick={() => moderarEvidencia("REQUER_ANONIMIZACAO")} disabled={moderandoEvidencia || evidenciaStatusAtual === "REQUER_ANONIMIZACAO"} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50">Requer anonimização</button>
                <button type="button" onClick={() => moderarEvidencia("REJEITAR")} disabled={moderandoEvidencia} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Rejeitar e remover</button>
                <button type="button" onClick={() => moderarEvidencia("APROVAR_PRIVADA")} disabled={moderandoEvidencia || evidenciaStatusAtual === "APROVADA_PRIVADA" || evidenciaStatusAtual === "REQUER_ANONIMIZACAO"} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{moderandoEvidencia ? "Salvando..." : "Aprovar privada"}</button>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
