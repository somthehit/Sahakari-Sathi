import { Response, NextFunction } from 'express';
import type { AuthRequest } from './authMiddleware';

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param allowedRoles Array of roles permitted to access the route
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Check for bypass in prototype/mock mode
    if (process.env.API_MODE === 'false') {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    // In a real app, roles are usually stored in Supabase Custom Claims or the database
    // req.user.role would be populated by the custom claim
    const userRole = (req.user as any).role || 'user'; 

    // Super Admin override or Role match
    if (userRole === 'admin' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Forbidden: Insufficient permissions to access this resource' 
    });
  };
};
