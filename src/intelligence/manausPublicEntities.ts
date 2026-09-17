export type ManausPublicEntity = {
  key: string;
  nome: string;
  sigla: string;
  cnpj: string;
  tipo: "municipio" | "secretaria" | "autarquia" | "fundo" | "outro";
  ativo: boolean;
  source: string;
};

const defaults: ManausPublicEntity[] = [
  {
    key: "municipio_manaus",
    nome: "Município de Manaus",
    sigla: "PMM",
    cnpj: "04365326000173",
    tipo: "municipio",
    ativo: true,
    source: "cadastro_municipal",
  },
  {
    key: "semsa_manaus",
    nome: "Manaus Secretaria Municipal de Saúde",
    sigla: "SEMSA",
    cnpj: "04461836000144",
    tipo: "secretaria",
    ativo: true,
    source: "pncp_verificado_2026",
  },
  {
    key: "immu_manaus",
    nome: "Instituto Municipal de Mobilidade Urbana",
    sigla: "IMMU",
    cnpj: "33681104000168",
    tipo: "autarquia",
    ativo: true,
    source: "pncp_verificado_2026",
  },
  {
    key: "seminf_manaus",
    nome: "Secretaria Municipal de Infraestrutura",
    sigla: "SEMINF",
    cnpj: "17349848000123",
    tipo: "secretaria",
    ativo: true,
    source: "pncp_verificado_2026",
  },
];

function digits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

export function manausPublicEntities(): ManausPublicEntity[] {
  const raw = process.env.MANAUS_INSTITUTIONS_JSON || "";
  if (!raw.trim()) return defaults;
  try {
    const parsed = JSON.parse(raw);
    const extra: ManausPublicEntity[] = (Array.isArray(parsed) ? parsed : []).flatMap((item: any, index: number) => {
      const cnpj = digits(item?.cnpj);
      if (cnpj.length !== 14) return [];
      return [{
        key: String(item?.key || item?.sigla || `cadastro_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        nome: String(item?.nome || item?.name || "Cadastro público").trim(),
        sigla: String(item?.sigla || "").trim(),
        cnpj,
        tipo: (["municipio", "secretaria", "autarquia", "fundo", "outro"].includes(String(item?.tipo)) ? String(item.tipo) : "outro") as ManausPublicEntity["tipo"],
        ativo: item?.ativo !== false,
        source: "env",
      }];
    });
    const byCnpj = new Map<string, ManausPublicEntity>();
    for (const item of [...defaults, ...extra]) byCnpj.set(item.cnpj, item);
    return [...byCnpj.values()];
  } catch {
    return defaults;
  }
}
