import { sign, verify } from 'hono/jwt';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { encodeBase64, decodeBase64 } from 'hono/utils/encode';
import type { Context } from 'hono';

// JWT secret key - should be obtained from environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// JWT configuration
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate password hash using Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Hash using PBKDF2
  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  // Combine salt and hash
  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  
  // Convert to base64
  return encodeBase64(combined.buffer);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Decode from base64
    const combined = decodeBase64(hash);
    
    // Extract salt and hash
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // Recalculate hash using the same salt
    const key = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      256
    );
    
    const computedHash = new Uint8Array(hashBuffer);
    
    // Compare hash values
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== storedHash[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generate JWT token
 */
export async function generateToken(userId: number, username: string): Promise<string> {
  const payload = {
    userId,
    username,
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return await sign(payload, JWT_SECRET, JWT_ALGORITHM);
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<{ userId: number; username: string } | null> {
  try {
    const payload = await verify(token, JWT_SECRET, JWT_ALGORITHM) as any;
    
    if (!payload.userId || !payload.username) {
      return null;
    }
    
    return {
      userId: payload.userId,
      username: payload.username
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Get current user from request
 */
export async function getCurrentUser(c: Context): Promise<{ userId: number; username: string } | null> {
  // First try to get token from Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (user) return user;
  }
  
  // Then try to get token from cookie
  const token = getCookie(c, 'auth_token');
  if (token) {
    const user = await verifyToken(token);
    if (user) return user;
  }
  
  return null;
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(c: Context, token: string): void {
  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: JWT_EXPIRES_IN,
    path: '/'
  });
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(c: Context): void {
  deleteCookie(c, 'auth_token');
}

/**
 * Authentication middleware
 */
export async function authMiddleware(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const user = await getCurrentUser(c);
  
  if (!user) {
    return c.redirect('/login');
  }
  
  // Store user information in context
  c.set('user', user);
  await next();
}

/**
 * Optional authentication middleware (does not require login)
 */
export async function optionalAuthMiddleware(c: Context, next: () => Promise<void>): Promise<void> {
  const user = await getCurrentUser(c);
  
  if (user) {
    c.set('user', user);
  }
  
  await next();
}