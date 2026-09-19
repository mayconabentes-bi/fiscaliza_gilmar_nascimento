export type EvidenceUploadStatus = "NAO_SOLICITADO" | "COMPLETO" | "PARCIAL" | "FALHA";

export type EvidenceUploadSummary = {
  status: EvidenceUploadStatus;
  solicitadas: number;
  anexadas: number;
  falhas: number;
};

const VALIDATION_MESSAGES = new Set([
  "Formato de evidência inválido",
  "Tipo de evidência não permitido",
  "Tamanho de evidência inválido",
]);

function safeCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(7, Math.trunc(parsed))) : 0;
}

export function isEvidenceValidationFailure(error: unknown) {
  return error instanceof Error && VALIDATION_MESSAGES.has(error.message);
}

export function summarizeEvidenceUpload(requested: unknown, uploaded: unknown): EvidenceUploadSummary {
  const solicitadas = safeCount(requested);
  const anexadas = Math.min(solicitadas, safeCount(uploaded));
  const falhas = Math.max(0, solicitadas - anexadas);

  if (solicitadas === 0) return { status: "NAO_SOLICITADO", solicitadas, anexadas, falhas };
  if (falhas === 0) return { status: "COMPLETO", solicitadas, anexadas, falhas };
  if (anexadas === 0) return { status: "FALHA", solicitadas, anexadas, falhas };
  return { status: "PARCIAL", solicitadas, anexadas, falhas };
}

export function evidenceUploadWarning(summary: EvidenceUploadSummary) {
  if (summary.status === "FALHA") {
    return `Seu registro foi criado e o protocolo foi preservado, mas ${summary.falhas} foto${summary.falhas === 1 ? "" : "s"} não pôde${summary.falhas === 1 ? "" : "eram"} ser anexada${summary.falhas === 1 ? "" : "s"} neste momento.`;
  }
  if (summary.status === "PARCIAL") {
    return `Seu registro foi criado. ${summary.anexadas} de ${summary.solicitadas} fotos foram anexadas; ${summary.falhas} não puderam ser anexadas neste momento.`;
  }
  return "";
}

export function persistedEvidenceSummary(row: Record<string, unknown>) {
  return summarizeEvidenceUpload(row.evidencia_upload_solicitadas, row.evidencia_upload_anexadas);
}
