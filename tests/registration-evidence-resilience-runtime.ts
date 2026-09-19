import {
  evidenceUploadWarning,
  isEvidenceValidationFailure,
  persistedEvidenceSummary,
  summarizeEvidenceUpload,
} from "../src/server/demandEvidenceResilience.js";
import { EvidenceStorageUnavailableError } from "../src/server/evidenceStorage.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const none = summarizeEvidenceUpload(0, 0);
expect(none.status === "NAO_SOLICITADO" && none.falhas === 0, "Sem foto deve ser NAO_SOLICITADO.");

const complete = summarizeEvidenceUpload(3, 3);
expect(complete.status === "COMPLETO" && complete.falhas === 0, "Lote completo deve ser COMPLETO.");

const partial = summarizeEvidenceUpload(3, 2);
expect(partial.status === "PARCIAL" && partial.falhas === 1, "Lote parcial deve registrar uma falha.");
expect(evidenceUploadWarning(partial).includes("2 de 3"), "Aviso parcial deve informar quantidade anexada.");

const failed = summarizeEvidenceUpload(2, 0);
expect(failed.status === "FALHA" && failed.falhas === 2, "Falha total deve preservar contagem.");
expect(evidenceUploadWarning(failed).includes("protocolo foi preservado"), "Falha total deve informar preservação do protocolo.");

const persisted = persistedEvidenceSummary({
  evidencia_upload_solicitadas: 7,
  evidencia_upload_anexadas: 5,
});
expect(persisted.status === "PARCIAL" && persisted.falhas === 2, "Replay deve reconstruir o mesmo estado de evidências.");

expect(isEvidenceValidationFailure(new Error("Formato de evidência inválido")), "Formato inválido deve ser erro do cliente.");
expect(!isEvidenceValidationFailure(new EvidenceStorageUnavailableError()), "Storage indisponível não deve virar erro 400.");

console.log("registration P1.2 evidence resilience runtime: ok");
