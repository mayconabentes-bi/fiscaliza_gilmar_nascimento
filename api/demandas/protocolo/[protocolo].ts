import { getHealthyPostgres } from "../../../src/server/postgres.js";
import { cleanProtocol } from "../../../src/server/requestValidation.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  let protocolo: string;
  try {
    protocolo = cleanProtocol(req.query.protocolo);
  } catch {
    return res.status(404).json({ error: "Protocolo não encontrado." });
  }

  try {
    const sql = await getHealthyPostgres();
    const [demanda] = await sql`
      select protocolo, municipio, categoria, tipo_problema, status, created_at, updated_at
      from public.demandas
      where protocolo = ${protocolo}
      limit 1
    `;

    if (!demanda) {
      return res.status(404).json({ error: "Protocolo não encontrado." });
    }

    const historico = await sql`
      select status_novo, created_at
      from public.historico_status_demandas
      where demanda_id = (
        select id from public.demandas where protocolo = ${protocolo} limit 1
      )
      order by created_at asc
    `;

    res.setHeader("Cache-Control", "no-store, private");
    return res.status(200).json({ demanda, historico });
  } catch (error) {
    console.error("Falha ao consultar protocolo via Vercel:", error);
    return res.status(500).json({ error: "Não foi possível consultar o protocolo." });
  }
}
