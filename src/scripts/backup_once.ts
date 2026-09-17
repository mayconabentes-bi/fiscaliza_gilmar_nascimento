import { BackupService } from '../modules/infraestrutura-operacional/infrastructure/backup/BackupService.js';

const service = new BackupService();
const snapshot = await service.createSnapshot();
console.log(`Backup concluído: ${snapshot}`);
