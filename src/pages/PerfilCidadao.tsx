import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardList, KeyRound, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";
import { demandCategoryLabel, demandProblemLabel } from "../shared/demandTaxonomy";

const ageLabels: Record<string, string> = {
  AGE_16_17: "16 a 17 anos",
  AGE_18_24: "18 a 24 anos",
  AGE_25_34: "25 a 34 anos",
  AGE_35_44: "35 a 44 anos",
  AGE_45_59: "45 a 59 anos",
  AGE_60_PLUS: "60 anos ou mais",
};

const statusLabels: Record<string, string> = {
  RECEBIDA: "Recebido",
  EM_TRIAGEM: "Em triagem",
  ENCAMINHADA: "Encaminhado",
  EM_ANALISE: "Em análise",
  EM_EXECUCAO: "Em andamento",
  CONCLUIDA: "Concluído",
  INDEFERIDA: "Encerrado",
};

type Registro = {
  protocolo: string;
  categoria: string;
  tipo_problema: string;
  status: string;
  created_at: string;
};

export default function PerfilCidadao({ user }: { user: any }) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [recordsError, setRecordsError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetchWithTimeout(
          "/api/minha-conta/demandas",
          { credentials: "same-origin", cache: "no-store" },
          10000,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar seus registros.");
        if (!active) return;
        const list = Array.isArray(data.registros) ? data.registros : [];
        setRegistros(list.slice(0, 3));
        setTotal(Number(data.total || list.length));
      } catch (error: any) {
        if (active) setRecordsError(error?.message || "Não foi possível carregar seus registros.");
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <section className="py-2 sm:py-4">
        <span className="section-kicker">Minha conta</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#172033] sm:text-4xl">Perfil</h1>
        <p className="mt-2 text-sm leading-6 text-[#657089]">Confira os dados básicos da sua conta e seus registros mais recentes.</p>
      </section>

      <section className="surface-card mt-5 p-5 sm:p-7">
        <div className="flex items-center gap-3 border-b border-[#edf0f6] pb-5">
          <span className="icon-tile"><UserRound className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-[#172033]">{user?.nome_completo || "Pessoa usuária"}</p>
            <p className="truncate text-sm text-[#657089]">{user?.email || "E-mail não disponível"}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#f7f9fd] p-4">
            <MapPin className="h-4 w-4 text-[#1f2e6e]" />
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Localidade</p>
            <p className="mt-1 text-sm font-semibold text-[#34425b]">{[user?.bairro, user?.municipio].filter(Boolean).join(" · ") || "Não informada"}</p>
          </div>
          <div className="rounded-2xl bg-[#f7f9fd] p-4">
            <ShieldCheck className="h-4 w-4 text-[#1f2e6e]" />
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7c879d]">Faixa etária</p>
            <p className="mt-1 text-sm font-semibold text-[#34425b]">{ageLabels[user?.faixa_etaria] || "Não informada"}</p>
          </div>
        </div>
      </section>

      <section className="surface-card mt-5 p-5 sm:p-7" aria-label="Resumo dos meus registros">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="icon-tile"><ClipboardList className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-extrabold text-[#172033]">Seus registros</h2>
              <p className="text-xs text-[#657089]">{total} {total === 1 ? "registro vinculado" : "registros vinculados"} à sua conta</p>
            </div>
          </div>
          <Link to="/meus-registros" className="text-sm font-extrabold text-[#1f2e6e]">Ver todos</Link>
        </div>

        {recordsError ? (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{recordsError}</p>
        ) : registros.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[#f7f9fd] p-4">
            <p className="text-sm font-semibold text-[#34425b]">Nenhum registro vinculado a esta conta ainda.</p>
            <Link to="/demandas/nova" className="mt-3 inline-flex text-sm font-extrabold text-[#1f2e6e]">Registrar uma ocorrência</Link>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[#edf0f6]">
            {registros.map((registro) => (
              <Link key={registro.protocolo} to={`/protocolo?codigo=${encodeURIComponent(registro.protocolo)}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#172033]">{demandProblemLabel(registro.categoria, registro.tipo_problema)}</p>
                  <p className="mt-1 text-xs text-[#657089]">{demandCategoryLabel(registro.categoria)} · {statusLabels[registro.status] || registro.status}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#7c879d]">{registro.protocolo}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#9aa5b7]" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-3">
        <Link to="/recuperar-acesso" className="surface-card flex min-h-16 items-center gap-3 p-4">
          <span className="icon-tile"><KeyRound className="h-4 w-4" /></span>
          <span><strong className="block text-sm text-[#172033]">Senha e acesso</strong><span className="mt-1 block text-xs text-[#657089]">Use a recuperação de acesso para redefinir sua senha.</span></span>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/privacidade" className="secondary-button min-h-12 justify-center px-3 text-sm">Privacidade</Link>
          <Link to="/termos" className="secondary-button min-h-12 justify-center px-3 text-sm">Termos</Link>
        </div>
      </section>
    </div>
  );
}
