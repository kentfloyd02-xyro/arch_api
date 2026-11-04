import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export function authenticate(req, res, next) {
    // Check Authorization Header: Bearer <token>
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    else if (req.cookies && req.cookies.archon_token) {
        token = req.cookies.archon_token;
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication token missing or invalid.'
            }
        });
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED_OR_INVALID',
                message: err.message || 'Invalid authentication token.'
            }
        });
    }
}
