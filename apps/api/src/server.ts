import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closePool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { ensureDefaultTenant } from './db/tenants.js';

async function main(): Promise<void> {
  const config = loadConfig();

  // Migrating at boot keeps a single-container deployment honest: the schema and
  // the code that expects it ship together. For multi-replica rollouts the
  // Kubernetes manifests run this as a Job first, and this call is then a no-op.
  await migrate();
  await ensureDefaultTenant();

  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      await closePool();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    { port: config.PORT, coach: config.ANTHROPIC_API_KEY ? 'model' : 'local' },
    'Cold Turkey API ready',
  );
}

main().catch((error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});
