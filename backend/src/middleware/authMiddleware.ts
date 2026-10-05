/**
 * Authentication and Role-Based Access Control (RBAC) Middleware
 * Verifies signed JWT bearer tokens and guards administrative/officer routes.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { fail } from '../lib/respond';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';

export interface AuthenticatedUser {
  nid: string;
  role: 'citizen' | 'buyer' | 'officer' | 'amin' | 'super_admin';
  name?: string;
  office?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Authenticate incoming request via JWT Bearer token
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    // In development mode, allow unauthenticated access for public read routes
    if (process.env.NODE_ENV !== 'production' && req.method === 'GET') {
      return next();
    }
    return fail(res, 'Authentication token required. Please sign in.', 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return fail(res, 'Session token expired. Please sign in again.', 401);
    }
    return fail(res, 'Invalid authentication credentials.', 403);
  }
}

/**
 * Require specific user role for route access
 */
export function requireRole(...allowedRoles: Array<'citizen' | 'buyer' | 'officer' | 'amin' | 'super_admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }
      return fail(res, 'Authentication required.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return fail(
        res,
        `Access denied. Role '${req.user.role}' is not authorized for this resource. Required: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
}
