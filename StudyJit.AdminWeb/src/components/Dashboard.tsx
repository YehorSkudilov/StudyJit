"use client";

import * as f from "@/lib/format";
import { UserList } from "./Users";
import { Bars, Head, Status, Tiles, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

/** The numbers at a glance; user tiles open the matching users, generation tiles the queue. */
export function Dashboard() {
  const { api, go } = useAdmin();
  const { data: d, error, busy, reload } = useLoad(() => api.dashboard(), "dashboard");
  const users = (filter: string | null) => () => go(filter ? `#/users?filter=${filter}` : "#/users");
  const generation = () => go("#/generation");

  return (
    <div className={s.stack}>
      <Head title="Dashboard" caption="Everyone using StudyJit, at a glance." onRefresh={reload} />
      <Status busy={busy && !d} error={error} />
      {d && (
        <>
          <Tiles
            tiles={[
              { label: "Users", value: f.number(d.totalUsers), onClick: users(null) },
              { label: "New", value: f.number(d.newUsers7d), note: `7 days · ${f.number(d.newUsers30d)} in 30`, onClick: users("new") },
              { label: "Disabled", value: f.number(d.disabledUsers), note: "can't sign in", onClick: users("disabled") },
              { label: "Admins", value: f.number(d.admins), note: "Admin or SuperAdmin", onClick: users("admins") },
              { label: "Quizzes", value: f.number(d.quizzesTotal), note: `${f.number(d.quizzesGenerated)} generated` },
              { label: "Questions", value: f.number(d.questionsTotal) },
              { label: "Files", value: f.number(d.filesTotal), note: f.bytes(d.storageBytes) },
              { label: "In the queue", value: f.number(d.queued + d.generating), note: `${d.generating} generating now`, onClick: generation },
              { label: "Failed", value: f.number(d.failed), note: "quizzes whose last try failed", onClick: generation },
            ]}
          />

          <div className={s.card}>
            <h3>Sign-ups</h3>
            <p className={s.small}>Last {d.signupsByDay.length} days</p>
            <Bars values={d.signupsByDay.map((x) => x.count)} labels={d.signupsByDay.map((x) => f.day(x.date))} />
          </div>
          <div className={s.card}>
            <h3>Quizzes created</h3>
            <p className={s.small}>Last {d.quizzesByDay.length} days</p>
            <Bars values={d.quizzesByDay.map((x) => x.count)} labels={d.quizzesByDay.map((x) => f.day(x.date))} />
          </div>

          <h2 className={s.section}>Newest users</h2>
          {d.recentUsers.length === 0 ? <p className={s.caption}>Nobody has signed up yet.</p> : <UserList users={d.recentUsers} />}
        </>
      )}
    </div>
  );
}
