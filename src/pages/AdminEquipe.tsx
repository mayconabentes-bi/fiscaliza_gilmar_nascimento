import { useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, RefreshCw, UserPlus, Users } from "lucide-react";
import { fetchWithTimeout } from "../lib/request";

type Perfil = "SUPER_ADMIN" | "ADMIN" | "COORDENADOR" | "ATENDENTE";

interface Membro {
  id: string;
  nome: string;
  email: string;
  perfil_acesso: Perfil;
  ativo: boolean;
  setor_id: string | null;
  setor_nome: string | null;
}

interface Setor {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}

const PERFIL_LABEL: Record<Perfil, string> = {
  SUPER_ADMIN: "Super administrador",
  ADMIN: "Administrador",
  COORDENADOR: "Coordenador de setor",
  ATENDENTE: "Atendente de setor",
};

const precisaSetor = (perfil: string) => perfil === "COORDENADOR" || perfil === "ATENDENTE";

async function chamarApi(url: string, init: RequestInit = {}) {
  const res = await fetchWithTimeout(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  }, 12000);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Falha na operação.");
  return data;
}

export default function AdminEquipe({ user }: { user: any }) {
  const souSuperAdmin = user?.perfil_acesso === "SUPER_ADMIN";
  const [membros, setMembros] = useState<Membro[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  const [novo, setNovo] = useState({ nome: "", email: "", perfil_acesso: "ATENDENTE", setor_id: "" });
  const [enviando, setEnviando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ perfil_acesso: "ATENDENTE", setor_id: "" });

  const perfisPermitidos: Perfil[] = souSuperAdmin
    ? ["ATENDENTE", "COORDENADOR", "ADMIN", "SUPER_ADMIN"]
    : ["ATENDENTE", "COORDENADOR"];
  const setoresAtivos = setores.filter((s) => s.ativo);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const data = await chamarApi("/api/admin/equipe");
      setMembros(Array.isArray(data?.membros) ? data.membros : []);
      setSetores(Array.isArray(data?.setores) ? data.setores : []);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível carregar a equipe.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const criar = async (event: FormEvent) => {
    event.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    try {
      const data = await chamarApi("/api/admin/equipe", {
        method: "POST",
        body: JSON.stringify({ ...novo, setor_id: precisaSetor(novo.perfil_acesso) ? novo.setor_id : null }),
      });
      setSenhaGerada({ nome: data.nome, senha: data.senha_temporaria });
      setNovo({ nome: "", email: "", perfil_acesso: "ATENDENTE", setor_id: "" });
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o membro.");
    } finally {
      setEnviando(false);
    }
  };

  const salvarEdicao = async (membro: Membro) => {
    setErro(null);
    setAviso(null);
    try {
      await chamarApi(`/api/admin/equipe/${membro.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          perfil_acesso: edicao.perfil_acesso,
          setor_id: precisaSetor(edicao.perfil_acesso) ? edicao.setor_id : null,
        }),
      });
      setEditandoId(null);
      setAviso(`Acesso de ${membro.nome} atualizado.`);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar.");
    }
  };

  const alternarAtivo = async (membro: Membro) => {
    const acao = membro.ativo ? "desativar" : "reativar";
    if (!window.confirm(`Confirma ${acao} o acesso de ${membro.nome}?`)) return;
    setErro(null);
    setAviso(null);
    try {
      await chamarApi(`/api/admin/equipe/${membro.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !membro.ativo }) });
      setAviso(`Acesso de ${membro.nome} ${membro.ativo ? "desativado" : "reativado"}.`);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível alterar a situação.");
    }
  };

  const novaSenha = async (membro: Membro) => {
    if (!window.confirm(`Gerar nova senha temporária para ${membro.nome}? A senha atual deixará de funcionar.`)) return;
    setErro(null);
    setAviso(null);
    try {
      const data = await chamarApi(`/api/admin/equipe/${membro.id}/senha-temporaria`, { method: "POST", body: "{}" });
      setSenhaGerada({ nome: membro.nome, senha: data.senha_temporaria });
    } catch (e: any) {
      setErro(e?.message || "Não foi possível gerar nova senha.");
    }
  };

  const podeGerenciar = (membro: Membro) =>
    membro.id !== user?.id && (souSuperAdmin || precisaSetor(membro.perfil_acesso));

  const campo = "w-full rounded-lg border border-[#cfd8e8] bg-white px-3 py-2 text-sm text-[#172033] focus:border-[#1f2e6e] focus:outline-none";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#1f2e6e]"><Users className="h-6 w-6" />Equipe interna</h1>
          <p className="mt-1 text-sm text-[#657089]">Cadastre a equipe e defina o papel e o setor de cada pessoa. Atendentes e coordenadores só veem as demandas do próprio setor.</p>
        </div>
        <button onClick={carregar} className="flex items-center gap-2 rounded-lg border border-[#cfd8e8] bg-white px-3 py-2 text-sm font-bold text-[#1f2e6e]"><RefreshCw className="h-4 w-4" />Atualizar</button>
      </header>

      {erro && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{erro}</div>}
      {aviso && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{aviso}</div>}

      {senhaGerada && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-amber-900"><KeyRound className="h-4 w-4" />Senha temporária de {senhaGerada.nome}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-mono text-base text-[#172033]">{senhaGerada.senha}</code>
            <button onClick={() => navigator.clipboard?.writeText(senhaGerada.senha)} className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white"><Copy className="h-4 w-4" />Copiar</button>
          </div>
          <p className="mt-2 text-xs text-amber-900">Ela aparece <strong>somente agora</strong>. Entregue à pessoa por um canal seguro (pessoalmente ou mensagem direta) e não a guarde em planilhas ou grupos.</p>
          <button onClick={() => setSenhaGerada(null)} className="mt-3 text-xs font-bold text-amber-900 underline">Já entreguei, ocultar</button>
        </div>
      )}

      <form onSubmit={criar} className="grid gap-3 rounded-xl border border-[#dde4ef] bg-white p-4 md:grid-cols-5">
        <input className={campo} placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required minLength={3} maxLength={120} />
        <input className={campo} type="email" placeholder="E-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required maxLength={254} />
        <select className={campo} value={novo.perfil_acesso} onChange={(e) => setNovo({ ...novo, perfil_acesso: e.target.value })}>
          {perfisPermitidos.map((p) => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}
        </select>
        <select className={campo} value={novo.setor_id} onChange={(e) => setNovo({ ...novo, setor_id: e.target.value })} disabled={!precisaSetor(novo.perfil_acesso)} required={precisaSetor(novo.perfil_acesso)}>
          <option value="">{precisaSetor(novo.perfil_acesso) ? "Escolha o setor" : "Acesso a todos os setores"}</option>
          {setoresAtivos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <button type="submit" disabled={enviando} className="primary-button flex items-center justify-center gap-2 rounded-lg px-4 py-2"><UserPlus className="h-4 w-4" />{enviando ? "Criando…" : "Adicionar"}</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#dde4ef] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#f5f7fb] text-xs uppercase text-[#657089]">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Papel</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={5} className="px-4 py-6 text-center text-[#657089]">Carregando…</td></tr>}
            {!carregando && membros.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[#657089]">Nenhum membro cadastrado.</td></tr>}
            {membros.map((m) => (
              <tr key={m.id} className={`border-t border-[#eef2fb] ${m.ativo ? "" : "opacity-60"}`}>
                <td className="px-4 py-3"><div className="font-bold text-[#172033]">{m.nome}{m.id === user?.id && <span className="ml-2 text-xs font-semibold text-[#657089]">(você)</span>}</div><div className="text-xs text-[#657089]">{m.email}</div></td>
                {editandoId === m.id ? (
                  <>
                    <td className="px-4 py-3"><select className={campo} value={edicao.perfil_acesso} onChange={(e) => setEdicao({ ...edicao, perfil_acesso: e.target.value })}>{perfisPermitidos.map((p) => <option key={p} value={p}>{PERFIL_LABEL[p]}</option>)}</select></td>
                    <td className="px-4 py-3"><select className={campo} value={edicao.setor_id} disabled={!precisaSetor(edicao.perfil_acesso)} onChange={(e) => setEdicao({ ...edicao, setor_id: e.target.value })}><option value="">{precisaSetor(edicao.perfil_acesso) ? "Escolha o setor" : "Todos os setores"}</option>{setoresAtivos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></td>
                    <td className="px-4 py-3">{m.ativo ? "Ativo" : "Desativado"}</td>
                    <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => salvarEdicao(m)} className="rounded-lg bg-[#1f2e6e] px-3 py-1.5 text-xs font-bold text-white">Salvar</button><button onClick={() => setEditandoId(null)} className="rounded-lg border border-[#cfd8e8] px-3 py-1.5 text-xs font-bold text-[#526078]">Cancelar</button></div></td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">{PERFIL_LABEL[m.perfil_acesso] || m.perfil_acesso}</td>
                    <td className="px-4 py-3">{m.setor_nome || (precisaSetor(m.perfil_acesso) ? "—" : "Todos")}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${m.ativo ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{m.ativo ? "Ativo" : "Desativado"}</span></td>
                    <td className="px-4 py-3 text-right">
                      {podeGerenciar(m) ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button onClick={() => { setEditandoId(m.id); setEdicao({ perfil_acesso: m.perfil_acesso, setor_id: m.setor_id || "" }); }} className="rounded-lg border border-[#cfd8e8] px-3 py-1.5 text-xs font-bold text-[#1f2e6e]">Editar</button>
                          <button onClick={() => novaSenha(m)} className="rounded-lg border border-[#cfd8e8] px-3 py-1.5 text-xs font-bold text-[#1f2e6e]">Nova senha</button>
                          <button onClick={() => alternarAtivo(m)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${m.ativo ? "border border-rose-200 text-rose-700" : "border border-emerald-200 text-emerald-700"}`}>{m.ativo ? "Desativar" : "Reativar"}</button>
                        </div>
                      ) : <span className="text-xs text-[#9aa3b5]">—</span>}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
