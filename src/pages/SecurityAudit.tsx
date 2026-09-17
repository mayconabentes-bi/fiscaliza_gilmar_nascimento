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
      case "PASS": return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "FAIL": return <XCircle className="w-5 h-5 text-rose-500" />;
      case "WARNING": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <div className="w-5 h-5" />;
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
    <div className="max-w-7xl mx-auto py-12 px-4">
      <header className="mb-12 flex flex-col gap-5 lg:flex-row lg:justify-between lg:items-center">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 flex items-center gap-3">
            <ShieldCheck className="w-9 h-9 sm:w-10 sm:h-10 text-emerald-600" />
            Auditoria de Segurança & Conformidade LGPD
          </h1>
          <p className="mt-2 text-slate-600 text-base sm:text-lg">
            Relatório técnico de configurações de segurança, integridade e proteção de dados.
          </p>
        </div>
        <button
          onClick={fetchAudit}
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Auditando..." : "Reexecutar Auditoria"}
        </button>
      </header>

      {error && (
        <div className="mb-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <strong>Auditoria indisponível:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className={`p-8 rounded-2xl border-2 flex flex-col items-center justify-center text-center ${statusBoxClass}`}>
          <div className={`p-4 rounded-full mb-4 ${statusIconClass}`}>
            <ShieldCheck className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Status Geral</h2>
          <p className={`text-lg font-bold ${statusTextClass}`}>
            {loading && "EM VERIFICAÇÃO"}
            {!loading && overallStatus === "SECURE" && "SEM FALHAS CRÍTICAS DETECTADAS"}
            {!loading && overallStatus === "AT_RISK" && "FALHAS ALTAS DETECTADAS"}
            {!loading && overallStatus === "VULNERABLE" && "FALHAS CRÍTICAS DETECTADAS"}
            {!loading && overallStatus === null && "AUDITORIA INDISPONÍVEL"}
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2 text-slate-500 font-medium uppercase text-xs tracking-wider">
            <Lock className="w-4 h-4" /> Criptografia & Acesso
          </div>
          <div className="text-4xl font-light text-slate-900 mb-2">{securityPass} / {securityChecks.length}</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${securityPercent}%` }} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2 text-slate-500 font-medium uppercase text-xs tracking-wider">
            <UserCheck className="w-4 h-4" /> Conformidade LGPD
          </div>
          <div className="text-4xl font-light text-slate-900 mb-2">{lgpdPass} / {lgpdChecks.length}</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full" style={{ width: `${lgpdPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">Relatório detalhado de auditoria</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {!loading && !error && results.length === 0 && (
            <div className="p-6 text-sm text-slate-500">Nenhum resultado de auditoria foi retornado.</div>
          )}
          {results.map((result, index) => (
            <motion.div
              key={`${result.category}-${result.check}-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-6"
            >
              <div className="flex-shrink-0 pt-1">{getStatusIcon(result.status)}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h4 className="font-bold text-slate-900 text-lg">{result.check}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold ${getSeverityColor(result.severity)}`}>{result.severity}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">{result.category}</span>
                </div>
                <p className="text-slate-600 mb-3">{result.details}</p>
                {result.recommendation && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r text-sm text-amber-800">
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
