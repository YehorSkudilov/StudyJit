"use client";

import { useEffect } from "react";
import type { QuizRow } from "@/lib/api";
import * as f from "@/lib/format";
import { ActionRow, Head, Status, StatusBadge, useAct, useAdmin, useLoad } from "./ui";
import s from "./admin.module.css";

/** Quiz generation: what's running, the queue in order, recent failures to retry. */
export function Generation() {
  const { api } = useAdmin();
  const { data: d, error, busy, reload } = useLoad(() => api.generation(), "generation");
  const { act, working } = useAct(reload);

  // The queue moves on its own; keep it current while it's open.
  useEffect(() => {
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [reload]);

  return (
    <div className={s.stack}>
      <Head title="Generation" caption="Quizzes are generated one at a time, in order." onRefresh={reload} />
      <Status busy={busy && !d} error={error} />
      {d && (
        <>
          {!d.openAiConfigured && (
            <div className={s.card}>
              <p className={s.error}>OpenAI isn&apos;t set up on the server (OpenAI__ApiKey), so nothing can be generated.</p>
            </div>
          )}

          <h2 className={s.section}>Generating now</h2>
          <QuizList quizzes={d.running} empty="Nothing is generating." />

          <h2 className={s.section}>Queue</h2>
          <QuizList quizzes={d.queued} empty="The queue is empty." numbered />

          <h2 className={s.section}>Recently failed</h2>
          <div className={s.cardFlush}>
            {d.recentFailed.length === 0 && <p className={`${s.caption} ${s.row}`}>No failures.</p>}
            {d.recentFailed.map((q) => (
              <ActionRow
                key={q.id}
                title={`${q.name} · ${q.userEmail}`}
                detail={`${q.files} files · ${q.numQuestions} questions asked · created ${f.date(q.createdAt)} · tap to retry`}
                disabled={working}
                onClick={() => act(() => api.retryQuiz(q.id), { confirm: `Generate "${q.name}" again?`, done: "Queued" })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuizList({ quizzes, empty, numbered }: { quizzes: QuizRow[]; empty: string; numbered?: boolean }) {
  return (
    <div className={s.cardFlush}>
      {quizzes.length === 0 && <p className={`${s.caption} ${s.row}`}>{empty}</p>}
      {quizzes.map((q, i) => (
        <a key={q.id} className={s.row} href={`#/user/${encodeURIComponent(q.userId)}`}>
          {numbered && <span className={s.avatar}>{i + 1}</span>}
          <span className={s.rowMain}>
            <span className={s.rowTitle}>{q.name}</span>
            <span className={s.small}>
              {q.userEmail} · {q.numQuestions} questions · {q.files} files
            </span>
          </span>
          <StatusBadge status={q.status} />
        </a>
      ))}
    </div>
  );
}
