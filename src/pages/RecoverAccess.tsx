import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";

type RecoveryConfig = { enabled: boolean; supportEmail: string | null };

export default function RecoverAccess() {
  const resetToken = useMemo(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return params.get("token") || "";
  }, []);

  const [mode, setMode] = useState<"password" | "email">("password");
  const [config, setConfig] = useState<RecoveryConfig>({ enabled: true, supportEmail: null });
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    fetch("/api/auth/recovery/config", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setConfig({ enabled: Boolean(data.enabled), supportEmail: data.supportEmail || null }); })
      .catch(() => undefined);
  }, []);

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a recuperação agora.");
      setMessage(data.message || "Se houver uma conta com esse e-mail, enviaremos as instruções.");
    } catch (err: any) {
      setError(err?.message || "Não foi possível iniciar a recuperação agora.");
    } finally { setLoading(false); }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (newPassword.length < 8) return setError("A nova senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmPassword) return setError("As senhas informadas não coincidem.");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível redefinir a senha.");
      setResetDone(true);
      setMessage(data.message || "Senha alterada com sucesso.");
      window.history.replaceState(null, "", "/recuperar-acesso");
    } catch (err: any) {
      setError(err?.message || "Não foi possível redefinir a senha.");
    } finally { setLoading(false); }
  };

  if (resetToken && !resetDone) return (
    <div className="mx-auto max-w-md py-8 sm:py-14"><section className="surface-card p-5 sm:p-7">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d7e0f2] bg-white text-[#1f2e6e] shadow-sm"><KeyRound className="h-5 w-5" /></div>
      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#172033]">Criar nova senha</h1>
      <p className="mt-2 text-sm leading-6 text-[#657089]">Este link tem validade curta e deixa de funcionar assim que a senha é alterada.</p>
      <form className="mt-6 space-y-5" onSubmit={resetPassword}>
        {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
        <label className="block"><span className="text-sm font-bold text-[#34425b]">Nova senha</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field" /></label>
        <label className="block"><span className="text-sm font-bold text-[#34425b]">Confirmar nova senha</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field" /></label>
        <button type="submit" disabled={loading} className="primary-button min-h-12 w-full">{loading ? "Alterando..." : "Alterar senha"}</button>
      </form>
    </section></div>
  );

  if (resetDone) return (
    <div className="mx-auto max-w-md py-8 sm:py-14"><section className="surface-card p-5 text-center sm:p-7">
      <ShieldCheck className="mx-auto h-10 w-10 text-emerald-700" />
      <h1 className="mt-4 text-2xl font-extrabold text-[#172033]">Senha atualizada</h1>
      <p className="mt-3 text-sm leading-6 text-[#657089]">{message}</p>
      <Link to="/login" className="primary-button mt-6 min-h-12 w-full">Entrar com a nova senha</Link>
    </section></div>
  );

  return (
    <div className="mx-auto max-w-md py-8 sm:py-14"><section className="surface-card overflow-hidden p-5 sm:p-7">
      <div className="-mx-5 -mt-5 mb-5 h-1 bg-[#f36a10] sm:-mx-7 sm:-mt-7" aria-hidden="true" />
      <h1 className="text-3xl font-extrabold tracking-[-0.045em] text-[#172033]">Recuperar acesso</h1>
      <p className="mt-2 text-sm leading-6 text-[#657089]">Escolha a situação que melhor descreve o problema de acesso.</p>
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-[#eef2fb] p-1" role="group" aria-label="Tipo de recuperação">
        <button type="button" aria-pressed={mode === "password"} onClick={() => { setMode("password"); setError(""); setMessage(""); }} className={`min-h-11 rounded-lg px-3 text-sm font-bold ${mode === "password" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}>Esqueci a senha</button>
        <button type="button" aria-pressed={mode === "email"} onClick={() => { setMode("email"); setError(""); setMessage(""); }} className={`min-h-11 rounded-lg px-3 text-sm font-bold ${mode === "email" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}>Não lembro o e-mail</button>
      </div>
      {mode === "password" ? (
        <form className="mt-6 space-y-5" onSubmit={requestReset}>
          {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
          {message && <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm text-emerald-800">{message}</div>}
          {!config.enabled && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3.5 text-sm text-amber-800">A recuperação automática ainda está sendo configurada.</div>}
          <label className="block"><span className="text-sm font-bold text-[#34425b]">E-mail da conta</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="voce@exemplo.com" /></label>
          <p className="text-xs leading-5 text-[#657089]">A resposta é sempre genérica para proteger a privacidade e não revelar quais e-mails possuem conta.</p>
          <button type="submit" disabled={loading || !config.enabled} className="primary-button min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Enviando..." : "Enviar link de recuperação"}</button>
        </form>
      ) : (
        <div className="mt-6 rounded-2xl border border-[#d7e0f2] bg-[#f8faff] p-5">
          <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#1f2e6e]" /><div><h2 className="font-extrabold text-[#172033]">Recuperação assistida do e-mail</h2><p className="mt-2 text-sm leading-6 text-[#657089]">Por segurança, o FISCALIZE não revela automaticamente um e-mail usando nome, bairro ou outros dados fáceis de conhecer. A identificação precisa ser validada pelo atendimento.</p></div></div>
          {config.supportEmail ? <a href={`mailto:${config.supportEmail}?subject=Recuperação de acesso ao FISCALIZE`} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#cfd8e8] bg-white px-4 text-sm font-extrabold text-[#1f2e6e]">Falar com o atendimento</a> : <p className="mt-4 text-sm font-semibold text-[#657089]">O contato de atendimento ainda não está disponível nesta tela.</p>}
        </div>
      )}
      <p className="mt-6 text-center text-sm text-[#657089]"><Link to="/login" className="font-extrabold text-[#1f2e6e] underline decoration-[#f36a10] decoration-2 underline-offset-4">Voltar para o login</Link></p>
    </section></div>
  );
}
