import pg from 'pg';
import { env } from '../config/env.js';
const { Pool } = pg;
export const primaryPool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined
});
export const backupPool = env.DATABASE_BACKUP_URL
    ? new Pool({
        connectionString: env.DATABASE_BACKUP_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: { rejectUnauthorized: false }
    })
    : null;
primaryPool.on('error', (err) => {
    console.error('[DB Primary] Unexpected pool error on idle client:', err.message);
});
if (backupPool) {
    backupPool.on('error', (err) => {
        console.error('[DB Backup] Unexpected pool error on idle client:', err.message);
    });
}
/**
 * Execute a query with automatic failover to the secondary pool if primary fails.
 */
export async function query(text, params) {
    try {
        return await primaryPool.query(text, params);
    }
    catch (primaryError) {
        if (env.DB_FAILOVER_ENABLED && backupPool) {
            console.warn('[DB Failover] Primary query failed. Routing to backup database:', primaryError.message);
            try {
                return await backupPool.query(text, params);
            }
            catch (backupError) {
                console.error('[DB Failover] Backup query failed as well:', backupError.message);
                throw backupError;
            }
        }
        throw primaryError;
    }
}
/**
 * Get a client from the pool (prefers primary pool).
 */
export async function getClient() {
    try {
        return await primaryPool.connect();
    }
    catch (err) {
        if (env.DB_FAILOVER_ENABLED && backupPool) {
            console.warn('[DB Failover] Primary connect failed. Returning client from backup pool.');
            return await backupPool.connect();
        }
        throw err;
    }
}
/**
 * Health check utility returning status of primary and secondary databases.
 */
export async function checkDatabaseHealth() {
    const result = {
        primary: { status: 'down', latencyMs: 0, error: null },
        backup: { status: 'disabled', latencyMs: 0, error: null },
        activeSource: 'primary'
    };
    // Test Primary
    const startPrimary = Date.now();
    try {
        await primaryPool.query('SELECT 1 AS health');
        result.primary.status = 'healthy';
        result.primary.latencyMs = Date.now() - startPrimary;
    }
    catch (err) {
        result.primary.status = 'down';
        result.primary.error = err.message;
        result.activeSource = 'backup';
    }
    // Test Backup if configured
    if (backupPool) {
        const startBackup = Date.now();
        try {
            await backupPool.query('SELECT 1 AS health');
            result.backup.status = 'healthy';
            result.backup.latencyMs = Date.now() - startBackup;
        }
        catch (err) {
            result.backup.status = 'down';
            result.backup.error = err.message;
        }
    }
    return result;
}
