"use client";

import { ActionRow, Head, Info, Status, useAct, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

/** Settings that apply to everyone: every admin sees them, a SuperAdmin changes them. */
export function Settings() {
  const { api, go } = useAdmin();
  const { data, error, busy, reload } = useLoad(() => api.settings(), "settings");
  const { act, working } = useAct(reload);

  return (
    <div className={s.stack}>
      <Head title="Settings" caption="These apply to everyone." onRefresh={reload} />
      <Status busy={busy && !data} error={error} />
      {data && (
        <>
          <h2 className={s.section}>Sign-up</h2>
          <div className={s.card}>
            <Info
              rows={[
                ["Sign-up", data.signUpEnabled ? "Open: anyone can register on the website" : "Closed: only admins create accounts"],
              ]}
            />
          </div>
          <div className={s.cardFlush}>
            {api.isSuperAdmin ? (
              <ActionRow
                title={data.signUpEnabled ? "Close sign-up" : "Open sign-up"}
                detail={data.signUpEnabled ? "The website stops offering Register" : "Anyone can register on the website again"}
                danger={data.signUpEnabled}
                disabled={working}
                onClick={() =>
                  act(() => api.setSettings({ ...data, signUpEnabled: !data.signUpEnabled }), {
                    confirm: data.signUpEnabled
                      ? "Nobody can register on the website until it's opened again. Existing accounts can still sign in, and admins can create accounts on the Users page."
                      : "Anyone can register on the website again.",
                    done: data.signUpEnabled ? "Sign-up closed" : "Sign-up opened",
                  })
                }
              />
            ) : (
              <p className={`${s.caption} ${s.row}`}>Only a SuperAdmin can change this.</p>
            )}
            <ActionRow title="Create an account" detail="Make a user yourself, with a password you pass on" onClick={() => go("#/users?new=1")} />
          </div>
        </>
      )}
    </div>
  );
}
