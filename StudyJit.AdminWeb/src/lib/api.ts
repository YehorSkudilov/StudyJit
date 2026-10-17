// The admin site's side of the API's /api/admin endpoints (StudyJit.Api/Admin/AdminController.cs). The API checks every
// permission; the page only follows the same rules so it doesn't offer what would be refused. The API's address is baked
// in at build time (NEXT_PUBLIC_API_URL), and the API must allow this site's origin (Cors__AllowedOrigins).

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const AdminRole = "Admin";
export const SuperAdminRole = "SuperAdmin";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role?: string | null;
  status: "Active" | "Locked" | "Disabled";
  quizzes: number;
  files: number;
  storageBytes: number;
};

export type DayCount = { date: string; count: number };

export type DashboardResponse = {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  disabledUsers: number;
  admins: number;
  quizzesTotal: number;
  quizzesGenerated: number;
  questionsTotal: number;
  filesTotal: number;
  storageBytes: number;
  queued: number;
  generating: number;
  failed: number;
  signupsByDay: DayCount[];
  quizzesByDay: DayCount[];
  recentUsers: UserRow[];
};

export type QuizRow = {
  id: number;
  name: string;
  userId: string;
  userEmail: string;
  status: string;
  queueNumber?: number | null;
  numQuestions: number;
  questions: number;
  lastScore?: number | null;
  files: number;
  createdAt: string;
};

export type FileRow = { id: number; name: string; size: number; mimeType?: string | null; uploadedAt: string };

export type UserDetail = {
  user: UserRow;
  bio?: string | null;
  activeSessions: number;
  quizzes: QuizRow[];
  files: FileRow[];
};

export type GenerationResponse = {
  openAiConfigured: boolean;
  running: QuizRow[];
  queued: QuizRow[];
  recentFailed: QuizRow[];
};

type AuthResponse = {
  userId: string;
  email: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
};

/** The API refused the request; the message is safe to show. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The session can't be renewed, or the account lost its admin role: sign in again. */
export class SessionExpiredError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
  }
}

export type Session = {
  userId: string;
  email: string;
  role: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
};

const storageKey = "studyjit.admin.session";

/** The "role" claim of an access token: Admin, SuperAdmin, or null for everyone else. */
function roleOf(accessToken: string): string | null {
  try {
    const part = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const role = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))).role;
    return role === AdminRole || role === SuperAdminRole ? role : null;
  } catch {
    return null;
  }
}

// Only the refresh token is kept between visits; access tokens live in memory.
function load(): Session | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    return null;
  }
}

function save(session: Session | null) {
  try {
    if (session) {
      const { userId, email, role, refreshToken } = session;
      localStorage.setItem(storageKey, JSON.stringify({ userId, email, role, refreshToken }));
    } else localStorage.removeItem(storageKey);
  } catch {
    // Storage blocked (private window): the session lasts until the tab closes.
  }
}

async function problem(response: Response): Promise<ApiError> {
  let message: string | undefined;
  try {
    const body = await response.json();
    const errors = body?.errors ? (Object.values(body.errors) as string[][]).flat() : [];
    message = body?.error ?? errors[0] ?? body?.title;
  } catch {
    // Not a JSON body (e.g. a proxy error page).
  }
  message ??=
    response.status === 429
      ? "Too many attempts. Please wait a minute and try again."
      : response.status === 403
        ? "You don't have permission to do that."
        : "Something went wrong. Please try again.";
  return new ApiError(response.status, message);
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${apiUrl}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export class AdminApi {
  session: Session | null = typeof window === "undefined" ? null : load();
  private refreshing: Promise<string> | null = null;
  /** Called when the session was cleared and the page should go back to sign-in. */
  onExpired?: (message: string) => void;

  get isSuperAdmin() {
    return this.session?.role === SuperAdminRole;
  }

  /** Signs in; refuses (and revokes the new session of) an account that isn't an admin. */
  async signIn(email: string, password: string) {
    const response = await post("api/auth/login", { email, password });
    if (!response.ok) throw await problem(response);
    const auth = (await response.json()) as AuthResponse;
    const role = roleOf(auth.accessToken);
    if (!role) {
      await this.revoke(auth.refreshToken);
      throw new ApiError(403, "This account doesn't have admin access.");
    }
    this.set(auth, role);
  }

  async signOut() {
    if (this.session) await this.revoke(this.session.refreshToken);
    this.clear();
  }

  /** Gets a fresh access token, e.g. on opening the page to find out whether the saved session still works. */
  ensureSignedIn() {
    return this.accessToken(true);
  }

  dashboard = () => this.get<DashboardResponse>("api/admin/dashboard");

  users(query: string, filter: string | null) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    return this.get<UserRow[]>("api/admin/users" + (qs ? `?${qs}` : ""));
  }

  user = (id: string) => this.get<UserDetail>(`api/admin/users/${encodeURIComponent(id)}`);
  setDisabled = (id: string, disabled: boolean) => this.send("POST", userPath(id, "disabled"), { disabled });
  signOutEverywhere = (id: string) => this.send("POST", userPath(id, "sign-out"));
  /** SuperAdmin only. Null makes the account a regular user. */
  setRole = (id: string, role: string | null) => this.send("POST", userPath(id, "role"), { role });
  /** SuperAdmin only. Deletes the account, all its quizzes and its files. */
  deleteUser = (id: string) => this.send("DELETE", `api/admin/users/${encodeURIComponent(id)}`);

  generation = () => this.get<GenerationResponse>("api/admin/generation");
  retryQuiz = (id: number) => this.send("POST", `api/admin/quizzes/${id}/retry`);
  /** SuperAdmin only. Deletes every file and vector store in the OpenAI account. */
  openAiCleanup = async () => {
    const response = await this.withToken("POST", "api/admin/openai/cleanup");
    return (await response.json()) as { deletedFiles: number; deletedVectorStores: number };
  };

  private async get<T>(path: string): Promise<T> {
    const response = await this.withToken("GET", path);
    return (await response.json()) as T;
  }

  private async send(method: string, path: string, body?: unknown) {
    await this.withToken(method, path, body);
  }

  private async withToken(method: string, path: string, body?: unknown): Promise<Response> {
    const request = (token: string) =>
      fetch(`${apiUrl}/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    let response = await request(await this.accessToken(false));
    if (response.status === 401) {
      // Rejected (expired early, revoked): renew once and retry.
      response = await request(await this.accessToken(true));
      if (response.status === 401) this.expire();
    }
    if (!response.ok) throw await problem(response);
    return response;
  }

  private accessToken(forceRefresh: boolean): Promise<string> {
    const s = this.session;
    if (!s) return Promise.reject(new SessionExpiredError());
    if (!forceRefresh && s.accessToken && (s.accessTokenExpiresAt ?? 0) > Date.now() + 60_000) return Promise.resolve(s.accessToken);
    // One refresh at a time: a refresh token works once.
    this.refreshing ??= this.refresh(s.refreshToken).finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async refresh(refreshToken: string): Promise<string> {
    const response = await post("api/auth/refresh", { refreshToken });
    if (response.status === 401 || response.status === 400) this.expire();
    if (!response.ok) throw await problem(response);
    const auth = (await response.json()) as AuthResponse;
    // The role is read from the database at every refresh, so a removed role shows up here.
    const role = roleOf(auth.accessToken);
    if (!role) {
      await this.revoke(auth.refreshToken);
      this.expire("This account no longer has admin access.");
    }
    this.set(auth, role!);
    return auth.accessToken;
  }

  private set(auth: AuthResponse, role: string) {
    this.session = {
      userId: auth.userId,
      email: auth.email,
      role,
      refreshToken: auth.refreshToken,
      accessToken: auth.accessToken,
      accessTokenExpiresAt: Date.parse(auth.accessTokenExpiresAt),
    };
    save(this.session);
  }

  private clear() {
    this.session = null;
    save(null);
  }

  private expire(message?: string): never {
    this.clear();
    const error = new SessionExpiredError(message);
    this.onExpired?.(error.message);
    throw error;
  }

  private async revoke(refreshToken: string) {
    try {
      await post("api/auth/logout", { refreshToken });
    } catch {
      // Best effort.
    }
  }
}

const userPath = (id: string, action: string) => `api/admin/users/${encodeURIComponent(id)}/${action}`;
