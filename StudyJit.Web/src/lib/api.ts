// The website's side of the StudyJit API (StudyJit.Api). The API's address is baked in at build time
// (NEXT_PUBLIC_API_URL), and the API must allow this site's origin (Cors__AllowedOrigins).
//
// Signing in gives a short-lived access token (kept in memory) and a refresh token (kept in localStorage, so the
// session survives a reload). apiFetch adds the access token to each call and renews it when it runs out.

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

type AuthResponse = {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
};

type Session = {
  userId: string;
  email: string;
  name: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
};

const storageKey = "studyjit.session";
let session: Session | null = null;
let loaded = false;
let refreshing: Promise<string | null> | null = null;

function current(): Session | null {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const saved = localStorage.getItem(storageKey);
      session = saved ? (JSON.parse(saved) as Session) : null;
    } catch {
      session = null;
    }
  }
  return session;
}

function save(next: Session | null) {
  session = next;
  try {
    if (next) {
      const { userId, email, name, refreshToken } = next;
      localStorage.setItem(storageKey, JSON.stringify({ userId, email, name, refreshToken }));
    } else localStorage.removeItem(storageKey);
  } catch {
    // Storage blocked (private window): the session lasts until the tab closes.
  }
}

function set(auth: AuthResponse) {
  save({
    userId: auth.userId,
    email: auth.email,
    name: auth.name,
    refreshToken: auth.refreshToken,
    accessToken: auth.accessToken,
    accessTokenExpiresAt: Date.parse(auth.accessTokenExpiresAt),
  });
}

/** True when there's a saved session (it may still turn out to have expired). */
export const isSignedIn = () => current() !== null;

async function post(path: string, body: unknown) {
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The API's message for a refused request, safe to show. */
async function errorOf(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return (body?.error as string) || (body?.title as string) || fallback;
  } catch {
    return response.status === 429 ? "Too many attempts. Please wait a minute and try again." : fallback;
  }
}

/** Whether anyone may register; an admin can turn sign-up off. Assumes open if the API can't be reached. */
export async function signUpEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/options`);
    return response.ok ? ((await response.json()) as { signUpEnabled: boolean }).signUpEnabled : true;
  } catch {
    return true;
  }
}

export async function signIn(email: string, password: string) {
  const response = await post("/api/auth/login", { email, password });
  if (!response.ok) throw new Error(await errorOf(response, "Invalid email or password"));
  set((await response.json()) as AuthResponse);
}

export async function register(name: string, email: string, password: string) {
  const response = await post("/api/auth/register", { name, email, password });
  if (!response.ok) throw new Error(await errorOf(response, "Registration failed"));
  set((await response.json()) as AuthResponse);
}

export async function signOut() {
  const s = current();
  save(null);
  if (s) {
    try {
      await post("/api/auth/logout", { refreshToken: s.refreshToken });
    } catch {
      // Best effort: the session is gone here either way.
    }
  }
}

/** Sends the user to the sign-in page, e.g. once the session can't be renewed. */
function expire() {
  save(null);
  if (typeof window !== "undefined" && window.location.pathname !== "/login") window.location.href = "/login";
}

async function accessToken(forceRefresh: boolean): Promise<string | null> {
  const s = current();
  if (!s) return null;
  if (!forceRefresh && s.accessToken && (s.accessTokenExpiresAt ?? 0) > Date.now() + 30_000) return s.accessToken;
  // One refresh at a time: a refresh token works once.
  refreshing ??= (async () => {
    try {
      const response = await post("/api/auth/refresh", { refreshToken: s.refreshToken });
      if (!response.ok) {
        if (response.status === 401 || response.status === 400) expire();
        return null;
      }
      const auth = (await response.json()) as AuthResponse;
      set(auth);
      return auth.accessToken;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * fetch() for the API: path is the API path ("/api/items/files"), and the signed-in user's access token goes with it.
 * A rejected token is renewed once and the call retried; if the session can't be renewed, it's off to sign-in.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const request = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${apiUrl}${path}`, { ...init, headers });
  };
  let response = await request(await accessToken(false));
  if (response.status === 401 && current()) {
    const token = await accessToken(true);
    if (!token) return response;
    response = await request(token);
    if (response.status === 401) expire();
  }
  return response;
}
