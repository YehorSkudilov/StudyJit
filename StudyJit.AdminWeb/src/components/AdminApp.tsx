"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminApi, apiUrl } from "@/lib/api";
import { Dashboard } from "./Dashboard";
import { Generation } from "./Generation";
import { UserDetailScreen } from "./UserDetail";
import { Users } from "./Users";
import { AdminContext, type Admin } from "./ui";
import s from "./admin.module.css";

// The whole admin site is this one page (a static export can't have a page per user), so screens are picked by the
// part after # in the address: #/users?filter=new, #/user/<id>, #/generation; anything else is the dashboard.

type Route = { screen: "dashboard" | "users" | "user" | "generation"; id?: string; filter?: string | null };

function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [screen, id] = path.split("/");
  if (screen === "users") return { screen, filter: new URLSearchParams(query).get("filter") };
  if (screen === "user" && id) return { screen, id: decodeURIComponent(id) };
  if (screen === "generation") return { screen };
  return { screen: "dashboard" };
}

const nav: [Route["screen"], string, string][] = [
  ["dashboard", "Dashboard", "#/"],
  ["users", "Users", "#/users"],
  ["generation", "Generation", "#/generation"],
];

export function AdminApp() {
  const api = useMemo(() => new AdminApi(), []);
  // Nothing is known until the browser has the saved session (the page is prerendered without one).
  const [state, setState] = useState<"checking" | "signedOut" | "signedIn">("checking");
  const [notice, setNotice] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ screen: "dashboard" });
  const [toastText, setToastText] = useState("");

  useEffect(() => {
    api.onExpired = (message) => {
      setNotice(message);
      setState("signedOut");
    };
    if (!api.session) {
      setState("signedOut");
      return;
    }
    api.ensureSignedIn().then(
      () => setState("signedIn"),
      () => setState("signedOut"),
    );
  }, [api]);

  useEffect(() => {
    const update = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const toast = useCallback((text: string) => {
    setToastText(text);
    setTimeout(() => setToastText((current) => (current === text ? "" : current)), 1800);
  }, []);

  const admin: Admin = useMemo(() => ({ api, go: (r: string) => (window.location.hash = r), toast }), [api, toast]);

  if (state === "checking") return <div className={s.signIn} />;
  if (state === "signedOut")
    return (
      <SignIn
        api={api}
        notice={notice}
        onSignedIn={() => {
          setNotice(null);
          setState("signedIn");
        }}
      />
    );

  return (
    <AdminContext.Provider value={admin}>
      <div className={s.shell}>
        <nav className={s.nav}>
          <div className={s.brand}>
            StudyJit <span>admin</span>
          </div>
          {nav.map(([screen, title, href]) => (
            <a key={screen} href={href} className={route.screen === screen || (screen === "users" && route.screen === "user") ? s.navLinkActive : s.navLink}>
              {title}
            </a>
          ))}
          <div className={s.navFooter}>
            <div>{api.session?.email}</div>
            <div className={s.small}>{api.session?.role}</div>
            <button
              className={s.buttonQuiet}
              style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }}
              onClick={async () => {
                await api.signOut();
                setState("signedOut");
              }}
            >
              Sign out
            </button>
          </div>
        </nav>
        <main className={s.main}>
          {route.screen === "dashboard" && <Dashboard />}
          {route.screen === "users" && <Users filter={route.filter ?? null} />}
          {route.screen === "user" && <UserDetailScreen id={route.id!} key={route.id} />}
          {route.screen === "generation" && <Generation />}
        </main>
      </div>
      {toastText && <div className={s.toast}>{toastText}</div>}
    </AdminContext.Provider>
  );
}

function SignIn({ api, notice, onSignedIn }: { api: AdminApi; notice: string | null; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email.trim(), password);
      onSignedIn();
    } catch (err) {
      setError(err instanceof TypeError ? "Couldn't reach the server. Check your connection and try again." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.signIn}>
      <form className={s.signInCard} onSubmit={submit}>
        <h1 className={s.title}>StudyJit admin</h1>
        <p className={s.caption}>Sign in with an admin account&apos;s email and password.</p>
        {!apiUrl && <p className={s.error}>This site was built without NEXT_PUBLIC_API_URL, so it can&apos;t reach the API.</p>}
        <input className={s.input} type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className={s.input}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className={s.error}>{error}</p>}
        <button className={s.button} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
