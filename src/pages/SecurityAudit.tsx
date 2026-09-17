import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Lock, RefreshCw, UserCheck } from "lucide-react";
import { motion } from "motion/react";
import { fetchWithTimeout } from "../lib/request";

interface AuditResult {
  category: "SECURITY" | "LGPD" | "INFRASTRUCTURE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  check: string;
  status: "PASS" | "FAIL" | "WARNING";
  details: string;
  recommendation?: string;
}

type OverallStatus = "SECURE" | "AT_RISK" | "VULNERABLE";

export default function SecurityAudit() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallStatus, setOverallStatus] = useState<OverallStatus | null>(null);

  const calculateOverallStatus = (data: AuditResult[]) => {
    const criticalFails = data.filter((result) => result.severity === "CRITICAL" && result.status === "FAIL");
    const highFails = data.filter((result) => result.severity === "HIGH" && result.status === "FAIL");

    if (criticalFails.length > 0) setOverallStatus("VULNERABLE");
    else if (highFails.length > 0) setOverallStatus("AT_RISK");
    else setOverallStatus("SECURE");
  };

  const fetchAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/admin/audit",
        { credentials: "same-origin", cache: "no-store" },
        10000,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Não foi possível executar a auditoria.");
      if (!Array.isArray(data)) throw new Error("Resposta de auditoria inválida.");
      setResults(data);
      calculateOverallStatus(data);
    } catch (err: any) {
      setResults([]);
      setOverallStatus(null);
      setError(err?.name === "AbortError" ? "A auditoria excedeu o tempo limite de resposta." : (err?.message || "Falha ao executar auditoria."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASS": return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "FAIL": return <XCircle className="h-5 w-5 text-rose-500" />;
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <div className="h-5 w-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "bg-rose-100 text-rose-800 border-rose-200";
      case "HIGH": return "bg-orange-100 text-orange-800 border-orange-200";
      case "MEDIUM": return "bg-amber-100 text-amber-800 border-amber-200";
      case "LOW": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const securityChecks = results.filter((result) => result.category === "SECURITY");
  const securityPass = securityChecks.filter((result) => result.status === "PASS").length;
  const lgpdChecks = results.filter((result) => result.category === "LGPD");
  const lgpdPass = lgpdChecks.filter((result) => result.status === "PASS").length;
  const securityPercent = securityChecks.length ? (securityPass / securityChecks.length) * 100 : 0;
  const lgpdPercent = lgpdChecks.length ? (lgpdPass / lgpdChecks.length) * 100 : 0;

  const statusBoxClass = overallStatus === "SECURE"
    ? "bg-emerald-50 border-emerald-200"
    : overallStatus === "AT_RISK"
      ? "bg-amber-50 border-amber-200"
      : overallStatus === "VULNERABLE"
        ? "bg-rose-50 border-rose-200"
        : "bg-slate-50 border-slate-200";

  const statusIconClass = overallStatus === "SECURE"
    ? "bg-emerald-100 text-emerald-600"
    : overallStatus === "AT_RISK"
      ? "bg-amber-100 text-amber-600"
      : overallStatus === "VULNERABLE"
        ? "bg-rose-100 text-rose-600"
        : "bg-slate-100 text-slate-500";

  const statusTextClass = overallStatus === "SECURE"
    ? "text-emerald-700"
    : overallStatus === "AT_RISK"
      ? "text-amber-700"
      : overallStatus === "VULNERABLE"
        ? "text-rose-700"
        : "text-slate-600";

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-2 sm:py-6">
      <header className="surface-card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f2e6e] via-[#1f2e6e] to-[#f36a10]" aria-hidden="true" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-kicker"><ShieldCheck className="h-4 w-4" /> FISCALIZE · Auditoria</div>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-extrabold tracking-[-0.04em] text-[#18255c] sm:text-4xl">
              Auditoria de segurança e conformidade LGPD
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#657089] sm:text-base">Verificações técnicas de segurança, integridade, acesso e proteção de dados do ambiente privado.</p>
          </div>
          <button onClick={fetchAudit} disabled={loading} className="primary-button min-h-12 shrink-0 px-5">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Auditando..." : "Reexecutar auditoria"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <strong>Auditoria indisponível:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`flex flex-col items-center justify-center rounded-2xl border-2 p-7 text-center ${statusBoxClass}`}>
          <div className={`mb-4 rounded-full p-4 ${statusIconClass}`}>
            <ShieldCheck className="h-11 w-11" />
          </div>
          <h2 className="mb-1 text-xl font-extrabold text-[#172033]">Status geral</h2>
          <p className={`text-sm font-extrabold ${statusTextClass}`}>
            {loading && "EM VERIFICAÇÃO"}
            {!loading && overallStatus === "SECURE" && "SEM FALHAS CRÍTICAS DETECTADAS"}
            {!loading && overallStatus === "AT_RISK" && "FALHAS ALTAS DETECTADAS"}
            {!loading && overallStatus === "VULNERABLE" && "FALHAS CRÍTICAS DETECTADAS"}
            {!loading && overallStatus === null && "AUDITORIA INDISPONÍVEL"}
          </p>
        </div>

        <div className="surface-card flex flex-col justify-center p-7">
          <div className="mb-2 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[#657089]">
            <Lock className="h-4 w-4 text-[#1f2e6e]" /> Criptografia e acesso
          </div>
          <div className="mb-2 text-4xl font-extrabold tracking-[-0.04em] text-[#172033]">{securityPass} / {securityChecks.length}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef2fb]">
            <div className="h-full bg-emerald-500" style={{ width: `${securityPercent}%` }} />
          </div>
        </div>

        <div className="surface-card flex flex-col justify-center p-7">
          <div className="mb-2 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-[#657089]">
            <UserCheck className="h-4 w-4 text-[#1f2e6e]" /> Conformidade LGPD
          </div>
          <div className="mb-2 text-4xl font-extrabold tracking-[-0.04em] text-[#172033]">{lgpdPass} / {lgpdChecks.length}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef2fb]">
            <div className="h-full bg-blue-500" style={{ width: `${lgpdPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="border-b border-[#dde4ef] bg-[#f8faff] px-6 py-5 sm:px-8">
          <h3 className="text-lg font-extrabold text-[#172033]">Relatório detalhado de auditoria</h3>
        </div>

        <div className="divide-y divide-[#eef2fb]">
          {!loading && !error && results.length === 0 && (
            <div className="p-6 text-sm text-[#657089]">Nenhum resultado de auditoria foi retornado.</div>
          )}
          {results.map((result, index) => (
            <motion.div
              key={`${result.category}-${result.check}-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col gap-6 p-6 transition-colors hover:bg-[#fbfcff] md:flex-row"
            >
              <div className="shrink-0 pt-1">{getStatusIcon(result.status)}</div>
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h4 className="text-lg font-extrabold text-[#172033]">{result.check}</h4>
                  <span className={`rounded border px-2 py-0.5 text-xs font-bold ${getSeverityColor(result.severity)}`}>{result.severity}</span>
                  <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{result.category}</span>
                </div>
                <p className="mb-3 text-[#657089]">{result.details}</p>
                {result.recommendation && (
                  <div className="rounded-r border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
                    <strong>Recomendação:</strong> {result.recommendation}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
