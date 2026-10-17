"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminRole, SuperAdminRole, type UserRow } from "@/lib/api";
import * as f from "@/lib/format";
import { Badges, Chips, Head, Status, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

// What the API's filter parameter takes; see AdminController.Users.
const filters: [string, string | null][] = [
  ["All", null],
  ["New", "new"],
  ["Admins", "admins"],
  ["Disabled", "disabled"],
];

/** Every account, newest first, searchable by email or name and filterable (the API returns up to 300). */
export function Users({ filter, create }: { filter: string | null; create: boolean }) {
  const { api, go } = useAdmin();
  const [creating, setCreating] = useState(create);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");

  // Searches once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const { data, error, busy, reload } = useLoad(() => api.users(query, filter), `${query}|${filter}`);

  return (
    <div className={s.stack}>
      <Head title="Users" caption={data ? `${f.number(data.length)}${data.length >= 300 ? "+" : ""} shown, newest first` : undefined} onRefresh={reload}>
        {!creating && (
          <button className={s.button} onClick={() => setCreating(true)}>
            New user
          </button>
        )}
      </Head>
      {creating && (
        <NewUserForm
          onDone={(id) => {
            setCreating(false);
            if (id) go(`#/user/${encodeURIComponent(id)}`);
          }}
        />
      )}
      <input className={s.input} type="search" placeholder="Search by email or name" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <Chips options={filters} value={filter} onChange={(v) => go(v ? `#/users?filter=${v}` : "#/users")} />
      <Status busy={busy && !data} error={error} />
      {data && (data.length === 0 ? <p className={s.caption}>No users match.</p> : <UserList users={data} />)}
    </div>
  );
}

export function UserList({ users }: { users: UserRow[] }) {
  return (
    <div className={s.cardFlush}>
      {users.map((u) => (
        <a key={u.id} className={s.row} href={`#/user/${encodeURIComponent(u.id)}`}>
          <span className={s.avatar}>{f.initials(u.name, u.email)}</span>
          <span className={s.rowMain}>
            <span className={s.rowTitle}>{u.name || u.email}</span>
            <span className={s.small}>
              {u.name ? `${u.email} · ` : ""}
              {u.quizzes} quizzes · {u.files} files ({f.bytes(u.storageBytes)}) · joined {f.ago(u.createdAt)}
            </span>
          </span>
          <Badges user={u} />
        </a>
      ))}
    </div>
  );
}

/** Makes an account; the admin passes the password on. Only a SuperAdmin can give it a role. */
function NewUserForm({ onDone }: { onDone: (id: string | null) => void }) {
  const { api, toast } = useAdmin();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function generate() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setPassword(Array.from(bytes, (b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join(""));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api.createUser({ email: email.trim(), name: name.trim(), password, role });
      toast("Account created");
      onDone(user.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.card} onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h3>New user</h3>
      <p className={s.small}>They sign in on the website with this email and password; send them both. At least 8 characters.</p>
      <input className={s.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={s.input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className={s.input}
          style={{ flex: 1 }}
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <button type="button" className={s.buttonQuiet} onClick={generate}>
          Generate
        </button>
      </div>
      {api.isSuperAdmin && (
        <Chips
          options={[
            ["Regular user", null],
            [AdminRole, AdminRole],
            [SuperAdminRole, SuperAdminRole],
          ]}
          value={role}
          onChange={setRole}
        />
      )}
      {error && <p className={s.error}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className={s.button} disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <button type="button" className={s.buttonQuiet} onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
