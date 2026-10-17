"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Monitor, Moon, Palette, Sun, type LucideIcon } from "lucide-react";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";

const themes: { value: ThemeChoice; label: string; detail: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", detail: "Match your device's light or dark setting", icon: Monitor },
  { value: "light", label: "Light", detail: "Always light", icon: Sun },
  { value: "dark", label: "Dark", detail: "Always dark", icon: Moon },
];

export default function AppSettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  useEffect(() => setTheme(readTheme()), []);

  return (
    <div className="page">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted mt-1">These apply to this browser.</p>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mt-8 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
              <Palette className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <h2 className="font-bold">Appearance</h2>
              <p className="text-sm text-muted">Light, dark, or the same as your device.</p>
            </div>
            <ThemeDropdown
              value={theme}
              onChange={(next) => {
                setTheme(next);
                applyTheme(next);
              }}
            />
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function ThemeDropdown({ value, onChange }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = themes.find((t) => t.value === value) ?? themes[0];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div className="relative sm:w-48" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 rounded-xl border border-stroke bg-surface px-3.5 py-2.5 font-semibold transition hover:border-brand/50 focus:outline-none focus:ring-4 focus:ring-brand/15"
      >
        <current.icon className="w-4 h-4 text-brand" />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown className={`w-4 h-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 z-20 mt-2 w-72 card p-1.5"
          >
            {themes.map((t) => (
              <li key={t.value}>
                <button
                  role="option"
                  aria-selected={t.value === value}
                  onClick={() => {
                    onChange(t.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    t.value === value ? "bg-brand-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <t.icon className={`w-4 h-4 ${t.value === value ? "text-brand" : "text-muted"}`} />
                  <span className="flex-1">
                    <span className={`block text-sm font-semibold ${t.value === value ? "text-brand" : ""}`}>{t.label}</span>
                    <span className="block text-xs text-muted">{t.detail}</span>
                  </span>
                  {t.value === value && <Check className="w-4 h-4 text-brand" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
