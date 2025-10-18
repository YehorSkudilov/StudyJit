"use client";

import { useState } from "react";

export default function AppSettingsPage() {
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
    autoSync: false,
  });

  const toggle = (key: keyof typeof settings) =>
    setSettings((p) => ({ ...p, [key]: !p[key] }));

  return (
    <main className="min-h-screen flex justify-center items-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-xl">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-8">App Settings</h1>

        {Object.keys(settings).map((key) => (
          <label
            key={key}
            className="flex justify-between items-center border-b py-3 text-gray-700"
          >
            <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
            <input
              type="checkbox"
              checked={settings[key as keyof typeof settings]}
              onChange={() => toggle(key as keyof typeof settings)}
              className="w-5 h-5 accent-blue-600"
            />
          </label>
        ))}

        <button className="w-full py-3 mt-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
          Save Settings
        </button>
      </div>
    </main>
  );
}
