"use client";

import { useEffect, useState } from "react";
import type { UserRow } from "@/lib/api";
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
export function Users({ filter }: { filter: string | null }) {
  const { api, go } = useAdmin();
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
      <Head title="Users" caption={data ? `${f.number(data.length)}${data.length >= 300 ? "+" : ""} shown, newest first` : undefined} onRefresh={reload} />
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
