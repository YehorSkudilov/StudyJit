"use client";

import { Head, Status, Toggle, useAct, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

/** Settings that apply to everyone: every admin sees them, a SuperAdmin changes them. */
export function Settings() {
  const { api } = useAdmin();
  const { data, error, busy, reload } = useLoad(() => api.settings(), "settings");
  const { act, working } = useAct(reload);

  return (
    <div className={s.stack}>
      <Head title="Settings" onRefresh={reload} />
      <Status busy={busy && !data} error={error} />
      {data && (
        <div className={s.cardFlush}>
          <Toggle
            title="Allow sign-ups"
            detail={
              api.isSuperAdmin
                ? data.signUpEnabled
                  ? "Anyone can register on the website"
                  : "Only admins create accounts, on the Users page"
                : "Only a SuperAdmin can change this"
            }
            on={data.signUpEnabled}
            disabled={working || !api.isSuperAdmin}
            onChange={(on) =>
              act(() => api.setSettings({ ...data, signUpEnabled: on }), {
                confirm: on
                  ? undefined
                  : "Nobody can register on the website until sign-ups are allowed again. Existing accounts can still sign in.",
                done: on ? "Sign-ups allowed" : "Sign-ups closed",
              })
            }
          />
        </div>
      )}
    </div>
  );
}
