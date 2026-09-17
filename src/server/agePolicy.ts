export const AGE_BANDS = ["UNDER_16", "AGE_16_17", "AGE_18_PLUS"] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export class AgePolicyError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "AGE_POLICY_INVALID") {
    super(message);
    this.name = "AgePolicyError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function parseAgeBand(value: unknown): AgeBand {
  if (typeof value !== "string") {
    throw new AgePolicyError("Informe sua faixa etária para continuar.", 400, "AGE_BAND_REQUIRED");
  }

  const normalized = value.trim().toUpperCase();
  if (!AGE_BANDS.includes(normalized as AgeBand)) {
    throw new AgePolicyError("Faixa etária inválida.", 400, "AGE_BAND_INVALID");
  }

  return normalized as AgeBand;
}

export function assertAutonomousParticipationAllowed(ageBand: AgeBand) {
  if (ageBand === "UNDER_16") {
    throw new AgePolicyError(
      "A participação autônoma no FISCALIZE está disponível a partir de 16 anos.",
      403,
      "AGE_UNDER_16_NOT_ALLOWED",
    );
  }
}

export function requiresEnhancedProtection(ageBand: AgeBand) {
  return ageBand === "AGE_16_17";
}

export function ageBandForActiveParticipation(value: unknown) {
  const ageBand = parseAgeBand(value);
  assertAutonomousParticipationAllowed(ageBand);
  return {
    ageBand,
    enhancedProtection: requiresEnhancedProtection(ageBand),
  };
}

export function publicAgeBandLabel(ageBand: AgeBand) {
  if (ageBand === "UNDER_16") return "Menos de 16 anos";
  if (ageBand === "AGE_16_17") return "16 a 17 anos";
  return "18 anos ou mais";
}
