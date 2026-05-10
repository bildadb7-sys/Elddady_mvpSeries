
import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Define User Interface based on JWT payload
interface AuthUser {
    id: string;
    aud?: string;
    role?: string;
    email?: string;
    app_metadata?: any;
    user_metadata?: any;
    exp?: number;
}

// --- IDOR PROTECTION (Broken Access Control) ---
// Factory function to create ownership checks efficiently
export const ensureOwnership = (
    tableName: string,
    resourceIdParam: string = 'id', // The param name in req.params
    supabase: SupabaseClient
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user as AuthUser;
        const resourceId = (req as any).params[resourceIdParam];

        if (!user || !user.id) {
            return (res as any).status(401).json({ error: 'Unauthorized' });
        }

        try {
            // Optimized Query: SELECT user_id FROM table WHERE id = ?
            // We do NOT select * to save bandwidth and DB I/O
            const { data, error } = await supabase
                .from(tableName)
                .select('owner_id') // Assuming 'owner_id' or 'user_id' is the column
                .eq('id', resourceId)
                .single();

            if (error || !data) {
                return (res as any).status(404).json({ error: 'Resource not found' });
            }

            // Strict Check
            if (data.owner_id !== user.id) {
                console.warn(`[Security] IDOR Attempt: User ${user.id} tried to access ${tableName}:${resourceId}`);
                return (res as any).status(403).json({ error: 'Forbidden' });
            }

            next();
        } catch (err) {
            console.error('IDOR Check Error:', err);
            return (res as any).status(500).json({ error: 'Internal Server Error' });
        }
    };
};

// --- JWT AUTHENTICATION ---
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return (res as any).status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return (res as any).status(401).json({ error: 'Bearer token missing' });
    }

    // --- PRODUCTION SECURITY ENFORCEMENT ---
    try {
        const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_APP_SUPABASE_URL) as string;
        const SUPABASE_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_APP_ANON_KEY) as string;

        // Use a dynamic import or the pre-imported module to bypass ESM require issues
        import('@supabase/supabase-js').then(({ createClient }) => {
            const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_KEY);

            supabaseAuth.auth.getUser(token).then(({ data, error }: any) => {
                if (error || !data.user) {
                    console.error("JWT Verification Failed via Supabase API:", error?.message);
                    return (res as any).status(403).json({ error: 'Invalid or expired token' });
                }
                (req as any).user = data.user;
                next();
            });
        }).catch(err => {
            console.error("Supabase Import Failed:", err);
            return (res as any).status(500).json({ error: 'Auth subsystem error' });
        });
    } catch (err) {
        console.error("JWT Verification Failed:", err);
        return (res as any).status(403).json({ error: 'Invalid or expired token' });
    }
};
