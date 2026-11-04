import { app } from './app.js';
import { env } from './config/env.js';
import { checkDatabaseHealth } from './db/connection.js';
const PORT = env.PORT || 4000;
async function startServer() {
    const server = app.listen(PORT, async () => {
        console.log(`==================================================================`);
        console.log(`🚀 ARCHON NELL CENTRALIZED BACKEND GATEWAY`);
        console.log(`📡 Listening on: http://localhost:${PORT}`);
        console.log(`🌐 Subdomain Gateway active for: *.archonnell.com`);
        console.log(`🛡️  Environment: ${env.NODE_ENV}`);
        console.log(`==================================================================`);
        const dbStatus = await checkDatabaseHealth();
        console.log(`📊 Primary Database (VPS Local): ${dbStatus.primary.status === 'healthy' ? '✅ Connected' : '⚠️ Offline'}`);
        if (env.DATABASE_BACKUP_URL) {
            console.log(`☁️  Backup Database (Supabase):  ${dbStatus.backup.status === 'healthy' ? '✅ Connected' : '⚠️ Offline'}`);
        }
    });
    const shutdown = () => {
        console.log('\nGracefully shutting down Central Gateway...');
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
