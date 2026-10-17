"use client";
import { useState } from "react";
import Image from "next/image";

export default function AppSettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSync: true,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6">
      {/* Card */}
      <div className="card p-8 w-full max-w-xl text-center">
        {/* ✅ Logo + App Name */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/images/logo-square.png"
            alt="StudyJit"
            width={100}
            height={100}
            className="mb-2"
            priority
          />
          <h1 className="text-3xl font-extrabold text-gradient">
            StudyJit
          </h1>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gradient mb-8">
          App Settings
        </h2>

        {/* Settings toggles */}
        <div className="space-y-4 text-left">
          {Object.entries(settings).map(([key, value]) => (
            <label
              key={key}
              className="flex justify-between items-center text-lg border-b border-gray-200 dark:border-gray-700 pb-3"
            >
              <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
              <input
                type="checkbox"
                checked={value}
                onChange={() => toggle(key as keyof typeof settings)}
                className="w-5 h-5 accent-blue-600 dark:accent-blue-400"
              />
            </label>
          ))}
        </div>

        {/* Save Button */}
        <button className="btn-primary w-full py-3 mt-8">
          Save Settings
        </button>
      </div>
    </div>
  );
}
