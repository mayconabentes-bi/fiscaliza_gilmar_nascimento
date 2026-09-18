import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ShieldCheck, User } from "lucide-react";

export default function Login({ setUser }: { setUser: (user: any) => void }) {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("admin") === "1" ? "admin" : "cidadao";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState<"cidadao" | "admin">(initialType);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const endpoint = type === "admin" ? "/api/auth/admin/login" : "/api/auth/login";
      const body = type === "admin" ? { email: normalizedEmail, password } : { email: normalizedEmail, password, type: "cidadao" };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json().catch(() => ({})) : {};
      if (!res.ok) {
        if (res.status === 401) throw new Error("E-mail ou senha inválidos.");
        if (!contentType.includes("application/json") || res.status >= 500) {
          throw new Error(data.error || "Serviço de autenticação temporariamente indisponível. Tente novamente em instantes.");
        }
        throw new Error(data.error || "Não foi possível entrar.");
      }
      if (!data?.user) throw new Error("Resposta inválida do serviço de autenticação.");

      const authenticatedUser = type === "admin" ? data.user : { ...data.user, type: "cidadao" };
      localStorage.setItem("user", JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      navigate(type === "admin" ? "/dashboard" : "/meus-registros");
    } catch (err: any) {
      setError(err?.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-8 sm:py-14">
      <div className="text-center">
        <span className="brand-signature-mark brand-signature-mark--login" aria-hidden="true"><img src="/brand/gilmar-nascimento-oficial.png" alt="" /></span>
        <span className="mx-auto mt-2 flex h-11 w-11 items-center justify-center rounded-xl border border-[#d7e0f2] bg-white text-[#1f2e6e] shadow-sm"><ShieldCheck className="h-5 w-5" /></span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.045em] text-[#172033]">Entrar no FISCALIZE</h1>
        <p className="mt-2 text-sm leading-6 text-[#657089]">Acesse sua conta ou o núcleo privado.</p>
      </div>

      <section className="surface-card mt-8 overflow-hidden p-5 sm:p-7">
        <div className="-mx-5 -mt-5 mb-5 h-1 bg-[#f36a10] sm:-mx-7 sm:-mt-7" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#eef2fb] p-1" role="group" aria-label="Tipo de acesso">
          <button type="button" aria-pressed={type === "cidadao"} onClick={() => { setType("cidadao"); setError(""); }} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition ${type === "cidadao" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}><span className="flex items-center justify-center gap-2"><User className="h-4 w-4" /> Pessoa</span></button>
          <button type="button" aria-pressed={type === "admin"} onClick={() => { setType("admin"); setError(""); }} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition ${type === "admin" ? "bg-white text-[#1f2e6e] shadow-sm" : "text-[#657089]"}`}><span className="flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4" /> Administrador</span></button>
        </div>

        {type === "admin" && <p className="mt-4 text-xs leading-5 text-[#657089]">Acesso privado. Não existe cadastro de administrador pela aplicação.</p>}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
          <label className="block"><span className="text-sm font-bold text-[#34425b]">E-mail</span><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="voce@exemplo.com" /></label>
          <label className="block"><span className="text-sm font-bold text-[#34425b]">Senha</span><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field" placeholder="Sua senha" /></label>
          {type === "cidadao" && <div className="-mt-2 text-right"><Link to="/recuperar-acesso" className="text-sm font-bold text-[#1f2e6e] underline decoration-[#f36a10] decoration-2 underline-offset-4">Esqueci minha senha ou e-mail</Link></div>}
          <button type="submit" disabled={loading} className="primary-button min-h-13 w-full text-base">{loading ? "Entrando..." : "Entrar"}<ArrowRight className="h-4 w-4" /></button>
        </form>

        {type === "cidadao" && <p className="mt-6 text-center text-sm text-[#657089]">Ainda não tem conta? <Link to="/register-cidadao" className="font-extrabold text-[#1f2e6e] underline decoration-[#f36a10] decoration-2 underline-offset-4">Criar conta</Link></p>}
      </section>
    </div>
  );
}
