import { query } from '../../db/connection.js';
export async function getAuditLogs(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 500);
    const offset = Math.max(Number(options.offset) || 0, 0);
    let sql = `
    SELECT
      a.id,
      a.user_id,
      a.module,
      a.action,
      a.resource_id,
      a.details,
      a.ip_address,
      a.user_agent,
      a.created_at,
      u.full_name AS user_full_name,
      u.email AS user_email,
      u.global_role AS user_role
    FROM auth_core.audit_logs a
    LEFT JOIN auth_core.users u ON u.id = a.user_id
  `;
    const conditions = [];
    const params = [];
    if (options.action && options.action !== 'all') {
        params.push(options.action);
        conditions.push(`a.action = $${params.length}`);
    }
    if (options.module && options.module !== 'all') {
        params.push(options.module);
        conditions.push(`a.module = $${params.length}`);
    }
    if (options.search && options.search.trim()) {
        params.push(`%${options.search.trim().toLowerCase()}%`);
        conditions.push(`(
      LOWER(a.action) LIKE $${params.length} OR
      LOWER(COALESCE(u.full_name, '')) LIKE $${params.length} OR
      LOWER(COALESCE(u.email, '')) LIKE $${params.length} OR
      LOWER(COALESCE(a.resource_id, '')) LIKE $${params.length} OR
      LOWER(a.details::text) LIKE $${params.length}
    )`);
    }
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await query(sql, params);
    return result.rows.map((row) => {
        let detailsText = '';
        let targetText = row.resource_id || '';
        if (row.details && typeof row.details === 'object') {
            if (row.details.details) {
                detailsText = String(row.details.details);
            }
            else if (row.details.message) {
                detailsText = String(row.details.message);
            }
            else {
                detailsText = JSON.stringify(row.details);
            }
            if (!targetText && row.details.target) {
                targetText = String(row.details.target);
            }
        }
        else if (row.details) {
            detailsText = String(row.details);
        }
        return {
            _id: row.id,
            id: row.id,
            module: row.module,
            action: row.action,
            target: targetText || '—',
            details: detailsText || '—',
            ip: row.ip_address || '127.0.0.1',
            userAgent: row.user_agent || 'Web Client',
            createdAt: row.created_at,
            performedBy: {
                id: row.user_id,
                name: row.user_full_name || 'System / Automated',
                email: row.user_email || 'system@archonnell.com',
                role: row.user_role || 'system'
            }
        };
    });
}
export async function createAuditLogRecord(data) {
    let finalUserId = data.userId;
    if (!finalUserId || finalUserId === 'guest') {
        const adminLookup = await query("SELECT id FROM auth_core.users WHERE global_role IN ('superadmin', 'admin') LIMIT 1");
        finalUserId = adminLookup.rows[0]?.id || null;
    }
    const detailsObj = typeof data.details === 'object' ? data.details : { message: data.details || 'Admin operation' };
    const res = await query(`INSERT INTO auth_core.audit_logs (user_id, module, action, resource_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`, [
        finalUserId,
        data.module || 'admin',
        data.action || 'ADMIN_ACTION',
        data.resourceId || null,
        JSON.stringify(detailsObj),
        data.ipAddress || '127.0.0.1',
        data.userAgent || 'Archon Admin Console'
    ]);
    return res.rows[0];
}
