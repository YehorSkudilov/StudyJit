"use client";

import { AdminRole, SuperAdminRole, type UserDetail } from "@/lib/api";
import * as f from "@/lib/format";
import { ActionRow, Badges, Info, Status, StatusBadge, Tiles, useAct, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

/**
 * One account: who it is, its quizzes and files, and what an admin can do about it. The API has the final say on every
 * action (nobody acts on their own account; only a SuperAdmin acts on another SuperAdmin, changes roles or deletes);
 * the buttons follow the same rules so they don't offer what would be refused.
 */
export function UserDetailScreen({ id }: { id: string }) {
  const { api } = useAdmin();
  const { data: d, error, busy, reload } = useLoad(() => api.user(id), id);

  return (
    <div className={s.stack}>
      <a href="#/users" className={s.small}>
        ← Users
      </a>
      <Status busy={busy && !d} error={error} />
      {d && <Detail d={d} reload={reload} />}
    </div>
  );
}

function Detail({ d, reload }: { d: UserDetail; reload: () => void }) {
  const { api, toast, go } = useAdmin();
  const { act, working } = useAct(reload);
  const u = d.user;
  const isSelf = u.id === api.session?.userId;
  const canAct = !isSelf && (u.role !== SuperAdminRole || api.isSuperAdmin);
  const note = isSelf ? "This is your account." : !canAct ? "Only a SuperAdmin can change a SuperAdmin's account." : null;
  const disabled = u.status === "Disabled";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      window.prompt(`Copy the ${what.toLowerCase()}:`, text);
    }
  }

  async function changeRole() {
    const choice = window.prompt(`Role for ${u.email}: type Admin, SuperAdmin, or none for a regular user.`, u.role ?? "none");
    if (choice == null) return;
    const role = [AdminRole, SuperAdminRole].find((r) => r.toLowerCase() === choice.trim().toLowerCase()) ?? null;
    if (role == null && choice.trim().toLowerCase() !== "none") return window.alert("That's not a role: Admin, SuperAdmin or none.");
    if (role === (u.role ?? null)) return;
    const what = !role
      ? "a regular user, with no admin access"
      : role === SuperAdminRole
        ? "a SuperAdmin, who can also change roles and delete accounts"
        : "an Admin, who can see every user and disable accounts";
    await act(() => api.setRole(u.id, role), { confirm: `${u.email} becomes ${what}. It takes effect within a few minutes.` });
  }

  async function remove() {
    const typed = window.prompt(
      `This permanently deletes ${u.email} and all of its quizzes and files. It can't be undone.\n\nType the email to confirm.`,
    );
    if (typed == null) return;
    if (typed.trim().toLowerCase() !== u.email.toLowerCase()) return window.alert("Not deleted: the email didn't match.");
    if (await act(() => api.deleteUser(u.id))) go("#/users");
  }

  return (
    <>
      <div className={s.head}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
          <span className={s.avatarLarge}>{f.initials(u.name, u.email)}</span>
          <div style={{ minWidth: 0 }}>
            <h1 className={s.title} style={{ overflowWrap: "anywhere" }}>
              {u.name || u.email}
            </h1>
            <p className={s.caption}>Joined {f.date(u.createdAt)}</p>
          </div>
        </div>
        <div className={s.chips}>
          <a className={s.buttonQuiet} href={`mailto:${u.email}`}>
            Email
          </a>
          <button className={s.buttonQuiet} onClick={() => copy(u.email, "Email")}>
            Copy email
          </button>
          <button className={s.buttonQuiet} onClick={reload}>
            Refresh
          </button>
        </div>
      </div>
      <Badges user={u} />

      <h2 className={s.section}>Actions</h2>
      {note && (
        <div className={s.card}>
          <p className={s.caption}>{note}</p>
        </div>
      )}
      {canAct && (
        <div className={s.cardFlush}>
          <ActionRow
            title={disabled ? "Enable account" : "Disable account"}
            detail={disabled ? "Lets them sign in again" : "Signs them out and keeps them out"}
            danger={!disabled}
            disabled={working}
            onClick={() =>
              act(() => api.setDisabled(u.id, !disabled), {
                confirm: disabled ? undefined : `${u.email} is signed out everywhere and can't sign in until it's enabled again.`,
              })
            }
          />
          <ActionRow
            title="Sign out everywhere"
            detail={`Ends all ${f.number(d.activeSessions)} sessions`}
            disabled={working}
            onClick={() =>
              act(() => api.signOutEverywhere(u.id), {
                confirm: `Every device signed in as ${u.email} is signed out within a few minutes.`,
                done: "Signed out everywhere",
              })
            }
          />
          {api.isSuperAdmin && (
            <>
              <ActionRow title="Change role" detail={u.role ?? "Regular user"} disabled={working} onClick={changeRole} />
              <ActionRow title="Delete account" detail="Removes it, its quizzes and its files for good" danger disabled={working} onClick={remove} />
            </>
          )}
        </div>
      )}

      <h2 className={s.section}>Account</h2>
      <div className={s.card}>
        <Info
          rows={[
            ["Joined", f.dateTime(u.createdAt)],
            ["Status", u.status],
            ["Email", u.email],
            ["Signed-in devices", f.number(d.activeSessions)],
            ["Role", u.role ?? "Regular user"],
            ["Bio", d.bio || "—"],
            [
              "User ID",
              <button key="id" className={s.chip} onClick={() => copy(u.id, "User ID")} style={{ fontSize: 12 }}>
                {u.id}
              </button>,
            ],
          ]}
        />
      </div>

      <Tiles
        tiles={[
          { label: "Quizzes", value: f.number(u.quizzes) },
          { label: "Files", value: f.number(u.files) },
          { label: "Storage", value: f.bytes(u.storageBytes) },
        ]}
      />

      <h2 className={s.section}>Quizzes</h2>
      <div className={s.cardFlush}>
        {d.quizzes.length === 0 && <p className={`${s.caption} ${s.row}`}>No quizzes yet.</p>}
        {d.quizzes.map((q) => (
          <div key={q.id} className={s.row}>
            <span className={s.rowMain}>
              <span className={s.rowTitle}>{q.name}</span>
              <span className={s.small}>
                {q.questions} of {q.numQuestions} questions · {q.files} files
                {q.lastScore != null ? ` · last score ${q.lastScore}%` : ""} · created {f.date(q.createdAt)}
              </span>
            </span>
            <StatusBadge status={q.status} />
          </div>
        ))}
      </div>

      <h2 className={s.section}>Files</h2>
      <div className={s.cardFlush}>
        {d.files.length === 0 && <p className={`${s.caption} ${s.row}`}>No files yet.</p>}
        {d.files.map((file) => (
          <div key={file.id} className={s.row}>
            <span className={s.rowMain}>
              <span className={s.rowTitle}>{file.name}</span>
              <span className={s.small}>
                {f.bytes(file.size)} · uploaded {f.dateTime(file.uploadedAt)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
