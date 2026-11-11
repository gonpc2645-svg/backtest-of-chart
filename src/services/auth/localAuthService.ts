import type { User } from '@supabase/supabase-js';

export type LocalAuthBackend = 'local_db' | 'local_device';

export interface LocalUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: number;
}

interface StoredDeviceUserRecord extends LocalUserProfile {
  saltHex: string;
  hashHex: string;
}

interface StoredSessionPayload {
  token: string;
  backend: LocalAuthBackend;
  expiresAt: number;
  user: LocalUserProfile;
}

const USERS_STORAGE_KEY = 'boc_local_auth_users_v1';
const SESSION_STORAGE_KEY = 'boc_local_auth_session_v1';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let expressAuthUnavailableUntilMs = 0;

function canProbeExpressAuth(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (host === 'localhost' || host === '127.0.0.1') && Date.now() >= expressAuthUnavailableUntilMs;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  let diff = 0;
  for (let i = 0; i < aHex.length; i++) {
    diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2HashHex(password: string, salt: Uint8Array): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure Web Crypto API is unavailable in this browser context.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltCopy = new Uint8Array(salt);
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltCopy.buffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(derivedBits));
}

function generateRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function readStoredUsers(): StoredDeviceUserRecord[] {
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredDeviceUserRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStoredUsers(users: StoredDeviceUserRecord[]): void {
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore quota errors
  }
}

function readStoredSession(): StoredSessionPayload | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSessionPayload;
    if (!parsed || !parsed.token || !parsed.user?.email || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(payload: StoredSessionPayload | null): void {
  try {
    if (!payload) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignore storage errors
  }
}

export function mapLocalProfileToUser(profile: LocalUserProfile, backend: LocalAuthBackend): User {
  return {
    id: profile.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: profile.email,
    created_at: new Date(profile.createdAt).toISOString(),
    app_metadata: {
      provider: backend,
      providers: [backend],
    },
    user_metadata: {
      ...(profile.fullName ? { full_name: profile.fullName, name: profile.fullName } : {}),
    },
  } as User;
}

async function callExpressAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: T } | null> {
  if (!canProbeExpressAuth()) return null;
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      expressAuthUnavailableUntilMs = Date.now() + 30_000;
      return null;
    }
    const data = (await res.json()) as T;
    return { status: res.status, data };
  } catch {
    expressAuthUnavailableUntilMs = Date.now() + 30_000;
    return null;
  }
}

export const LocalAuthService = {
  async getSessionUser(): Promise<{ user: User; backend: LocalAuthBackend } | null> {
    const stored = readStoredSession();
    if (!stored) return null;

    if (stored.backend === 'local_db' && canProbeExpressAuth()) {
      const apiRes = await callExpressAuth<{ success: boolean; user?: LocalUserProfile }>(
        '/api/auth/me',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${stored.token}` },
        }
      );
      if (apiRes) {
        if (apiRes.status === 200 && apiRes.data.user) {
          return {
            user: mapLocalProfileToUser(apiRes.data.user, 'local_db'),
            backend: 'local_db',
          };
        }
        if (apiRes.status === 401) {
          writeStoredSession(null);
          return null;
        }
      }
    }

    return {
      user: mapLocalProfileToUser(stored.user, stored.backend),
      backend: stored.backend,
    };
  },

  async signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ user: User | null; backend?: LocalAuthBackend; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName?.trim() || null;

    // 1. Try SQLite backend auth first when running locally with Express server
    const apiRes = await callExpressAuth<{
      success: boolean;
      error?: string;
      token?: string;
      expiresAt?: number;
      user?: LocalUserProfile;
    }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password, fullName: cleanName }),
    });

    if (apiRes) {
      if (apiRes.data.success && apiRes.data.user && apiRes.data.token && apiRes.data.expiresAt) {
        writeStoredSession({
          token: apiRes.data.token,
          backend: 'local_db',
          expiresAt: apiRes.data.expiresAt,
          user: apiRes.data.user,
        });
        return {
          user: mapLocalProfileToUser(apiRes.data.user, 'local_db'),
          backend: 'local_db',
          error: null,
        };
      }
      return {
        user: null,
        error: apiRes.data.error || 'Could not create account.',
      };
    }

    // 2. Fallback to device PBKDF2-SHA256 vault (for static Netlify hosting when Supabase is not configured)
    const users = readStoredUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      return {
        user: null,
        error: 'An account with this email already exists on this device. Please log in instead.',
      };
    }

    const saltBytes = new Uint8Array(16);
    window.crypto.getRandomValues(saltBytes);
    const saltHex = toHex(saltBytes);
    const hashHex = await derivePbkdf2HashHex(password, saltBytes);
    const now = Date.now();
    const profile: StoredDeviceUserRecord = {
      id: `dev_${generateRandomHex(12)}`,
      email: cleanEmail,
      fullName: cleanName,
      saltHex,
      hashHex,
      createdAt: now,
    };
    users.push(profile);
    writeStoredUsers(users);

    const token = generateRandomHex(24);
    const expiresAt = now + SESSION_TTL_MS;
    const publicProfile: LocalUserProfile = {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      createdAt: profile.createdAt,
    };
    writeStoredSession({
      token,
      backend: 'local_device',
      expiresAt,
      user: publicProfile,
    });

    return {
      user: mapLocalProfileToUser(publicProfile, 'local_device'),
      backend: 'local_device',
      error: null,
    };
  },

  async signIn(
    email: string,
    password: string
  ): Promise<{ user: User | null; backend?: LocalAuthBackend; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try SQLite backend auth when running locally
    const apiRes = await callExpressAuth<{
      success: boolean;
      error?: string;
      token?: string;
      expiresAt?: number;
      user?: LocalUserProfile;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    if (apiRes) {
      if (apiRes.data.success && apiRes.data.user && apiRes.data.token && apiRes.data.expiresAt) {
        writeStoredSession({
          token: apiRes.data.token,
          backend: 'local_db',
          expiresAt: apiRes.data.expiresAt,
          user: apiRes.data.user,
        });
        return {
          user: mapLocalProfileToUser(apiRes.data.user, 'local_db'),
          backend: 'local_db',
          error: null,
        };
      }
      if (apiRes.status !== 401) {
        return { user: null, error: apiRes.data.error || 'Could not sign in.' };
      }
      // If not found in SQLite, also check device vault below just in case created while server was down
      const deviceUsers = readStoredUsers();
      if (!deviceUsers.some((u) => u.email === cleanEmail)) {
        return { user: null, error: apiRes.data.error || 'Invalid email or password.' };
      }
    }

    // 2. Verify PBKDF2-SHA256 hash in device storage
    const users = readStoredUsers();
    const record = users.find((u) => u.email === cleanEmail);
    if (!record) {
      return { user: null, error: 'Invalid email or password.' };
    }

    const saltBytes = fromHex(record.saltHex);
    const actualHashHex = await derivePbkdf2HashHex(password, saltBytes);
    if (!constantTimeEqualHex(record.hashHex, actualHashHex)) {
      return { user: null, error: 'Invalid email or password.' };
    }

    const now = Date.now();
    const token = generateRandomHex(24);
    const expiresAt = now + SESSION_TTL_MS;
    const publicProfile: LocalUserProfile = {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      createdAt: record.createdAt,
    };
    writeStoredSession({
      token,
      backend: 'local_device',
      expiresAt,
      user: publicProfile,
    });

    return {
      user: mapLocalProfileToUser(publicProfile, 'local_device'),
      backend: 'local_device',
      error: null,
    };
  },

  async signOut(): Promise<void> {
    const stored = readStoredSession();
    writeStoredSession(null);
    if (stored && stored.backend === 'local_db') {
      await callExpressAuth('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored.token}` },
      });
    }
  },
};
