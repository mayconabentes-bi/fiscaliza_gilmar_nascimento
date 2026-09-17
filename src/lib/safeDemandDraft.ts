export const SAFE_DEMAND_DRAFT_KEY = "fiscalize_public_demand_draft_v1";
export const SAFE_DEMAND_DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

export type SafeDemandDraftValues = {
  bairro: string;
  categoria: string;
};

type StoredSafeDemandDraft = {
  version: 1;
  savedAt: number;
  expiresAt: number;
  values: SafeDemandDraftValues;
};

const safeText = (value: unknown, maxLength: number) =>
  String(value ?? "").trim().slice(0, maxLength);

function sanitizeValues(values: Partial<SafeDemandDraftValues>): SafeDemandDraftValues {
  return {
    bairro: safeText(values.bairro, 160),
    categoria: safeText(values.categoria, 120),
  };
}

export function saveSafeDemandDraft(
  values: Partial<SafeDemandDraftValues>,
  storage: Storage = window.localStorage,
  now = Date.now(),
) {
  const draft: StoredSafeDemandDraft = {
    version: 1,
    savedAt: now,
    expiresAt: now + SAFE_DEMAND_DRAFT_TTL_MS,
    values: sanitizeValues(values),
  };

  storage.setItem(SAFE_DEMAND_DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

export function readSafeDemandDraft(
  storage: Storage = window.localStorage,
  now = Date.now(),
): StoredSafeDemandDraft | null {
  const raw = storage.getItem(SAFE_DEMAND_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSafeDemandDraft>;
    if (parsed.version !== 1 || typeof parsed.expiresAt !== "number" || !parsed.values) {
      storage.removeItem(SAFE_DEMAND_DRAFT_KEY);
      return null;
    }

    if (parsed.expiresAt <= now) {
      storage.removeItem(SAFE_DEMAND_DRAFT_KEY);
      return null;
    }

    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : now,
      expiresAt: parsed.expiresAt,
      values: sanitizeValues(parsed.values),
    };
  } catch {
    storage.removeItem(SAFE_DEMAND_DRAFT_KEY);
    return null;
  }
}

export function clearSafeDemandDraft(storage: Storage = window.localStorage) {
  storage.removeItem(SAFE_DEMAND_DRAFT_KEY);
}
