"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AdminApi, SessionExpiredError, type UserRow } from "@/lib/api";
import * as f from "@/lib/format";
import s from "./admin.module.css";

/** What every screen gets: the API, moving to another screen, and a short confirmation. */
export type Admin = {
  api: AdminApi;
  go: (route: string) => void;
  toast: (text: string) => void;
};

export const AdminContext = createContext<Admin | null>(null);

export function useAdmin(): Admin {
  const admin = useContext(AdminContext);
  if (!admin) throw new Error("useAdmin outside AdminContext");
  return admin;
}

/** Loads with <paramref name="load"/> when <paramref name="key"/> changes; reload() loads again. */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setBusy(true);
    setError(null);
    load()
      .then((value) => current && setData(value))
      .catch((e: Error) => current && !(e instanceof SessionExpiredError) && setError(e.message))
      .finally(() => current && setBusy(false));
    return () => {
      current = false;
    };
    // load changes every render; key says when to load again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, busy, reload };
}

/**
 * Runs an action after an optional confirm, then reloads; a failure shows as an alert. True when it ran.
 */
export function useAct(reload?: () => void) {
  const { toast } = useAdmin();
  const [working, setWorking] = useState(false);
  const act = useCallback(
    async (action: () => Promise<unknown>, options: { confirm?: string; done?: string } = {}) => {
      if (options.confirm && !window.confirm(options.confirm)) return false;
      setWorking(true);
      try {
        await action();
        if (options.done) toast(options.done);
        reload?.();
        return true;
      } catch (e) {
        if (!(e instanceof SessionExpiredError)) window.alert(`Couldn't do that: ${(e as Error).message}`);
        return false;
      } finally {
        setWorking(false);
      }
    },
    [reload, toast],
  );
  return { act, working };
}

export function Head({ title, caption, onRefresh, children }: { title: string; caption?: string; onRefresh?: () => void; children?: ReactNode }) {
  return (
    <div className={s.head}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {caption && <p className={s.caption}>{caption}</p>}
      </div>
      <div className={s.chips}>
        {children}
        {onRefresh && (
          <button className={s.buttonQuiet} onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}

export function Status({ busy, error }: { busy: boolean; error: string | null }) {
  if (error) return <p className={s.error}>{error}</p>;
  if (busy) return <p className={s.caption}>Loading…</p>;
  return null;
}

export type Tile = { label: string; value: string; note?: string; onClick?: () => void };

export function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className={s.tiles}>
      {tiles.map((t) => {
        const body = (
          <>
            <div className={s.tileLabel}>{t.label}</div>
            <div className={s.tileValue}>{t.value}</div>
            {t.note && <div className={s.small}>{t.note}</div>}
          </>
        );
        return t.onClick ? (
          <button key={t.label} className={s.tile} onClick={t.onClick}>
            {body}
          </button>
        ) : (
          <div key={t.label} className={s.tile}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Bars, one per value; with <paramref name="stacked"/>, a second series on top in the second colour. */
export function Bars({ values, stacked, labels }: { values: number[]; stacked?: number[]; labels?: string[] }) {
  const max = Math.max(1, ...values.map((v, i) => v + (stacked?.[i] ?? 0)));
  return (
    <div className={s.bars} role="img" aria-label="Bar chart">
      {values.map((v, i) => (
        <div key={i} className={s.bar} title={labels ? `${labels[i]}: ${v}${stacked ? ` + ${stacked[i]}` : ""}` : String(v)}>
          <div className={s.barA} style={{ height: `${(v / max) * 100}%` }} />
          {stacked && <div className={s.barB} style={{ height: `${(stacked[i] / max) * 100}%` }} />}
        </div>
      ))}
    </div>
  );
}

export function Chips<T extends string | number | boolean | null>({ options, value, onChange }: { options: [string, T][]; value: T; onChange: (value: T) => void }) {
  return (
    <div className={s.chips}>
      {options.map(([title, v]) => (
        <button key={title} className={v === value ? s.chipOn : s.chip} onClick={() => onChange(v)}>
          {title}
        </button>
      ))}
    </div>
  );
}

export function Info({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={s.info}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The user's labels: role, and disabled or locked out. */
export function Badges({ user }: { user: UserRow }) {
  const badges: [string, string][] = [];
  if (user.role) badges.push([user.role, s.badgeAccent]);
  if (user.status === "Disabled") badges.push(["Disabled", s.badgeDanger]);
  else if (user.status === "Locked") badges.push(["Locked out", s.badgeWarning]);
  if (badges.length === 0) return null;
  return (
    <div className={s.badges}>
      {badges.map(([text, className]) => (
        <span key={text} className={className}>
          {text}
        </span>
      ))}
    </div>
  );
}

/** A quiz's generation status as a badge. */
export function StatusBadge({ status }: { status: string }) {
  const className =
    status === "failed" ? s.badgeDanger : status === "success" ? s.badgeSuccess : status === "queued" || status === "pending" ? s.badgeWarning : s.badge;
  return <span className={className}>{f.status(status)}</span>;
}

/** A row that runs an admin action. */
export function ActionRow({ title, detail, danger, disabled, onClick }: { title: string; detail: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={s.row} onClick={onClick} disabled={disabled}>
      <span className={s.rowMain}>
        <span className={`${s.rowTitle} ${danger ? s.rowDanger : ""}`}>{title}</span>
        <span className={s.small}>{detail}</span>
      </span>
      <span className={s.small}>›</span>
    </button>
  );
}
