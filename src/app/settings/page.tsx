"use client";
import { useState } from "react";

export default function AppSettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSync: true,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-xl">
        <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 text-center mb-8">
          App Settings
        </h2>

        <div className="space-y-4">
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

        <button className="w-full mt-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition">
          Save Settings
        </button>
      </div>
    </div>
  );
}
