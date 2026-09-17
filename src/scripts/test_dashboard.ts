import { DashboardService } from '../application/dashboard/DashboardService.js';
import { setupDatabase } from '../server/db.js';

setupDatabase();

console.log('Testing DashboardService.getDemandOverview()...');
try {
  const data = DashboardService.getDemandOverview();
  console.log('Data retrieved successfully:');
  console.log('Resumo:', data.resumo);
  console.log('Temas:', data.porTema.length);
  console.log('Bairros:', data.porBairro.length);
  console.log('Evolução:', data.evolucao.length);
} catch (error) {
  console.error('Error retrieving dashboard data:', error);
  process.exitCode = 1;
}
