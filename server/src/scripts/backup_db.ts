import { DatabaseService } from '../database/connection.js';

async function runBackup() {
  console.log('[Database Backup] Starting safe online backup of Backtest of Chart database...');
  const dbService = DatabaseService.getInstance();
  const startTime = Date.now();

  try {
    const result = dbService.backupDatabase();
    const durationMs = Date.now() - startTime;
    console.log(`[Database Backup] Success!`);
    console.log(`- Backup Path: ${result.backupPath}`);
    console.log(`- Size: ${(result.backupSizeBytes / (1024 * 1024)).toFixed(2)} MB (${result.backupSizeBytes} bytes)`);
    console.log(`- Duration: ${durationMs}ms`);
  } catch (err) {
    console.error('[Database Backup] Failed:', err);
    process.exit(1);
  }
}

runBackup();
