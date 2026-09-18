import { useEffect, useState } from "react";
import { Clock3, RefreshCw } from "lucide-react";

type RefreshRun = {
  id: number;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  sourcesTotal: number;
  sourcesAvailable: number;
  sourcesDegraded: number;
  sourcesUnavailable: number;
  sourcesNotConfigured: number;
};

type RefreshState = {
  running: boolean;
  latest: RefreshRun | null;
};

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    completed: "Concluída",
    completed_with_errors: "Concluída com alertas",
    failed: "Falhou",
    running: "Em andamento",
  };
  return status ? labels[status] || status : "Sem execução registrada";
}

export default function IntelligenceRefreshPanel({ onRefreshed }: { onRefreshed?: () => void }) {
  const [state, setState] = useState<RefreshState>({ running: false, latest: null });
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    const response = await fetch("/api/intelligence/refresh/status", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    setState(await response.json());
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, []);

  const refreshNow = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/intelligence/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao atualizar fontes");
      setState({ running: false, latest: payload });
      setMessage(payload.status === "completed" ? "Fontes atualizadas." : "Atualização concluída com alertas. Consulte o estado das fontes.");
      onRefreshed?.();
      window.dispatchEvent(new CustomEvent("pulso:intelligence-refreshed", { detail: { runId: payload.id } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar fontes.");
      await loadStatus().catch(() => undefined);
    } finally {
      setRefreshing(false);
    }
  };

  const latest = state.latest;
  const lastTime = latest?.finishedAt || latest?.startedAt;

  return (
    <div className="rounded-xl border border-[#dbe8e0] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#101513]"><Clock3 className="h-4 w-4 text-[#157a55]" /> Atualização das fontes</div>
          <p className="mt-1 text-sm text-[#69736d]">
            {lastTime ? `Último ciclo: ${new Date(lastTime).toLocaleString("pt-BR")} · ${statusLabel(latest?.status)}` : "Nenhum ciclo registrado neste banco."}
          </p>
          {latest ? (
            <p className="mt-1 text-xs text-[#8a928e]">
              {latest.sourcesAvailable} disponíveis · {latest.sourcesDegraded} com ressalvas · {latest.sourcesUnavailable} indisponíveis · {latest.sourcesNotConfigured} não configuradas
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing || state.running}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#157a55] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing || state.running ? "animate-spin" : ""}`} />
          {refreshing || state.running ? "Atualizando fontes..." : "Atualizar agora"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm font-semibold text-[#56615b]">{message}</p> : null}
    </div>
  );
}
