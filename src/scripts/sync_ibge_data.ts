import { getDb, setupDatabase } from '../server/db.js';
import { IBGEService } from '../services/ibgeService.js';

async function syncIBGE() {
  console.log('Starting IBGE Data Sync...');
  
  setupDatabase();
  const db = getDb();

  console.log('Fetching municipalities from IBGE...');
  const municipiosIBGE = await IBGEService.getMunicipiosAmazonas();
  
  if (!municipiosIBGE || municipiosIBGE.length === 0) {
    console.error('No municipalities found from IBGE API.');
    return;
  }

  console.log(`Found ${municipiosIBGE.length} municipalities. Syncing to database...`);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO municipios (id, nome, microrregiao, mesorregiao, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const updateStatsStmt = db.prepare(`
    UPDATE municipios SET populacao_estimada = ?, pib = ? WHERE id = ?
  `);

  // 1. Sync basic info (Names and IDs)
  const syncBasic = db.transaction((list) => {
    for (const m of list) {
      stmt.run(
        m.id.toString(),
        m.nome,
        m.microrregiao.nome,
        m.microrregiao.mesorregiao.nome
      );
    }
  });

  syncBasic(municipiosIBGE);
  console.log('Basic municipality info synced.');

  // 2. Fetch stats for top municipalities (Demo limited to avoid long wait)
  const topMunicipios = ['1302603', '1303403', '1301902', '1302504', '1304203']; // Manaus, Parintins, Itacoatiara, Manacapuru, Tefé
  
  console.log(`Fetching stats for ${topMunicipios.length} key municipalities...`);

  for (const id of topMunicipios) {
    const mun = municipiosIBGE.find(m => m.id.toString() === id);
    if (!mun) continue;

    console.log(`Syncing stats for ${mun.nome}...`);
    const pop = await IBGEService.getPopulacaoEstimada(id);
    const pib = await IBGEService.getPIB(id);
    
    updateStatsStmt.run(pop, pib, id);
    console.log(`  - Pop: ${pop || 'N/A'}, PIB: ${pib || 'N/A'}`);
  }

  console.log('IBGE Sync completed successfully!');
}

syncIBGE().catch(console.error);
