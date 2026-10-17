"use client";

import { motion } from "framer-motion";
import { Check, CornerDownLeft, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/study";
import { isRight } from "@/lib/study";

const kindLabel = { mcq: "Multiple choice", tf: "True or false", written: "Written" };

/**
 * One question to answer. Before answering it takes clicks, number keys (1–4), T/F or typing; once `given` is set it
 * shows what was right and wrong. In a test (`lockOnAnswer` off) a choice can still be changed.
 */
export default function ItemView({
  item,
  given,
  revealed,
  onAnswer,
  lockOnAnswer = true,
  keyboard = true,
  index,
}: {
  item: Item;
  given?: string | boolean;
  revealed: boolean;
  onAnswer: (given: string | boolean) => void;
  lockOnAnswer?: boolean;
  keyboard?: boolean;
  index?: number;
}) {
  const locked = revealed || (lockOnAnswer && given !== undefined);

  useEffect(() => {
    if (!keyboard || locked) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (item.kind === "mcq") {
        const n = Number(e.key);
        if (n >= 1 && n <= item.options.length) onAnswer(item.options[n - 1]);
      } else if (item.kind === "tf") {
        if (e.key === "t" || e.key === "ArrowLeft") onAnswer(true);
        if (e.key === "f" || e.key === "ArrowRight") onAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, keyboard, locked, onAnswer]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {index !== undefined && <span className="chip bg-brand-soft text-brand">{index + 1}</span>}
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          {(item.kind === "written" && item.label) || kindLabel[item.kind]}
        </span>
      </div>
      <h2 className="text-xl sm:text-2xl font-bold leading-snug">{item.prompt}</h2>

      {item.kind === "mcq" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {item.options.map((opt, i) => {
            const chosen = given === opt;
            const isAnswer = opt.trim().toLowerCase() === item.answer.trim().toLowerCase();
            const state = revealed ? (isAnswer ? "right" : chosen ? "wrong" : "dim") : chosen ? "chosen" : "idle";
            return (
              <motion.button
                key={opt}
                disabled={locked}
                onClick={() => onAnswer(opt)}
                initial={{ opacity: 0, y: 10 }}
                animate={state === "wrong" ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] } : { opacity: 1, y: 0, scale: state === "right" ? [1, 1.03, 1] : 1 }}
                transition={{ delay: revealed ? 0 : i * 0.05, duration: revealed ? 0.4 : 0.25 }}
                whileHover={locked ? undefined : { y: -2 }}
                whileTap={locked ? undefined : { scale: 0.98 }}
                className={`group flex items-start gap-3 text-left rounded-2xl border-2 px-4 py-3.5 transition-colors ${
                  state === "right"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : state === "wrong"
                    ? "border-red-500 bg-red-500/10"
                    : state === "chosen"
                    ? "border-brand bg-brand-soft"
                    : state === "dim"
                    ? "border-stroke opacity-50"
                    : "border-stroke bg-surface hover:border-brand/50"
                }`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center ${
                    state === "right"
                      ? "bg-emerald-500 text-white"
                      : state === "wrong"
                      ? "bg-red-500 text-white"
                      : state === "chosen"
                      ? "bg-brand text-white"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {state === "right" ? <Check className="w-4 h-4" /> : state === "wrong" ? <X className="w-4 h-4" /> : i + 1}
                </span>
                <span className="font-medium leading-snug pt-0.5">{opt}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {item.kind === "tf" && (
        <>
          <div className="mt-5 rounded-2xl bg-surface-2 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Answer</p>
            <p className="text-lg font-semibold">{item.statement}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[true, false].map((value) => {
              const chosen = given === value;
              const state = revealed ? (value === item.answer ? "right" : chosen ? "wrong" : "dim") : chosen ? "chosen" : "idle";
              return (
                <motion.button
                  key={String(value)}
                  disabled={locked}
                  onClick={() => onAnswer(value)}
                  whileTap={locked ? undefined : { scale: 0.97 }}
                  animate={state === "wrong" ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                  className={`rounded-2xl border-2 py-4 font-bold text-lg transition-colors ${
                    state === "right"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : state === "wrong"
                      ? "border-red-500 bg-red-500/10 text-red-500"
                      : state === "chosen"
                      ? "border-brand bg-brand-soft text-brand"
                      : state === "dim"
                      ? "border-stroke opacity-50"
                      : "border-stroke bg-surface hover:border-brand/50"
                  }`}
                >
                  {value ? "True" : "False"}
                  {keyboard && !locked && <span className="ml-2 text-xs font-medium text-muted">({value ? "T" : "F"})</span>}
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      {item.kind === "written" && (
        <WrittenAnswer
          key={item.key}
          locked={locked}
          revealed={revealed}
          given={typeof given === "string" ? given : ""}
          correct={revealed && isRight(item, given)}
          onAnswer={onAnswer}
          submitOnEnter={lockOnAnswer}
        />
      )}
    </div>
  );
}

function WrittenAnswer({
  locked,
  revealed,
  given,
  correct,
  onAnswer,
  submitOnEnter,
}: {
  locked: boolean;
  revealed: boolean;
  given: string;
  correct: boolean;
  onAnswer: (given: string) => void;
  submitOnEnter: boolean;
}) {
  const [text, setText] = useState(given);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (submitOnEnter) input.current?.focus();
  }, [submitOnEnter]);

  return (
    <form
      className="mt-6 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAnswer(text.trim());
      }}
    >
      <input
        ref={input}
        value={text}
        disabled={locked}
        onChange={(e) => {
          setText(e.target.value);
          // In a test the answer is kept as it's typed; there's no submit per question.
          if (!submitOnEnter) onAnswer(e.target.value);
        }}
        placeholder="Type your answer"
        className={`input text-lg py-3.5 ${
          revealed ? (correct ? "border-emerald-500 bg-emerald-500/10" : "border-red-500 bg-red-500/10") : ""
        }`}
      />
      {submitOnEnter && !locked && (
        <button type="submit" className="btn-primary px-4" disabled={!text.trim()} aria-label="Answer">
          <CornerDownLeft className="w-5 h-5" />
        </button>
      )}
    </form>
  );
}
