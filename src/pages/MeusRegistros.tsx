import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CirclePlus, ClipboardList, RefreshCw, Search } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";
import { demandCategoryLabel, demandProblemLabel } from "../shared/demandTaxonomy";

type Registro = {
  protocolo: string;
  municipio: string;
  bairro?: string | null;
  categoria: string;
  tipo_problema: string;
  prioridade: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const statusLabel: Record<string, string> = {
  RECEBIDA: "Recebido",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADA: "Encaminhado",
  EM_ANALISE: "Em análise",
  EM_EXECUCAO: "Em andamento",
  CONCLUIDA: "Concluído",
  INDEFERIDA: "Encerrado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Manaus",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default function MeusRegistros() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const carregar = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithTimeout(
        "/api/minha-conta/demandas",
        { credentials: "same-origin", cache: "no-store" },
        10000,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar seus registros.");
      setRegistros(Array.isArray(data.registros) ? data.registros : []);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar seus registros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <section className="flex flex-col gap-4 py-2 sm:flex-row sm:items-end sm:justify-between sm:py-4">
        <div>
          <span className="section-kicker">Minha conta</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Meus registros</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657089]">Veja os registros enviados com sua conta e abra o acompanhamento de qualquer protocolo.</p>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={loading} className="secondary-button min-h-11 justify-center px-4 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/demandas/nova" className="surface-card flex min-h-24 items-center gap-3 p-4">
          <span className="icon-tile shrink-0"><CirclePlus className="h-5 w-5" /></span>
          <span><strong className="block text-sm text-[#172033]">Registrar</strong><span className="mt-1 block text-xs text-[#657089]">Novo problema</span></span>
        </Link>
        <Link to="/protocolo" className="surface-card flex min-h-24 items-center gap-3 p-4">
          <span className="icon-tile shrink-0"><Search className="h-5 w-5" /></span>
          <span><strong className="block text-sm text-[#172033]">Acompanhar</strong><span className="mt-1 block text-xs text-[#657089]">Consultar protocolo</span></span>
        </Link>
      </div>

      {error && <div role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading && registros.length === 0 ? (
        <div className="mt-6 surface-card p-8 text-center text-sm text-[#657089]">Carregando seus registros...</div>
      ) : registros.length === 0 ? (
        <section className="mt-6 surface-card p-7 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2fb] text-[#1f2e6e]"><ClipboardList className="h-6 w-6" /></span>
          <h2 className="mt-4 text-xl font-extrabold text-[#172033]">Você ainda não tem registros nesta conta.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#657089]">Quando você registrar uma ocorrência estando conectado, ela aparecerá aqui automaticamente.</p>
          <Link to="/demandas/nova" className="primary-button mt-6 min-h-12 px-5">Registrar ocorrência</Link>
        </section>
      ) : (
        <section className="mt-6 space-y-3" aria-label="Lista dos meus registros">
          {registros.map((registro) => (
            <Link
              key={registro.protocolo}
              to={`/protocolo?codigo=${encodeURIComponent(registro.protocolo)}`}
              className="surface-card block p-4 transition hover:border-[#b8c4db] sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#eef2fb] px-2.5 py-1 text-[11px] font-extrabold text-[#1f2e6e]">{statusLabel[registro.status] || registro.status}</span>
                    <span className="text-xs text-[#7c879d]">{dateFormatter.format(new Date(registro.created_at))}</span>
                  </div>
                  <h2 className="mt-3 text-base font-extrabold text-[#172033]">{demandProblemLabel(registro.categoria, registro.tipo_problema)}</h2>
                  <p className="mt-1 text-xs font-semibold text-[#657089]">{demandCategoryLabel(registro.categoria)}</p>
                  <p className="mt-2 truncate font-mono text-xs text-[#526078]">{registro.protocolo}</p>
                </div>
                <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[#9aa5b7]" />
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
