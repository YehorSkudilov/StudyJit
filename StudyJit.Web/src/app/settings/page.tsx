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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      {/* Card */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-xl text-center">
        {/* ✅ Logo + App Name */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/images/logo.png"
            alt="App Logo"
            width={100}
            height={100}
            className="mb-2"
            priority
          />
          <h1 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            StudyBuddy
          </h1>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-8">
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
        <button className="w-full mt-8 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition">
          Save Settings
        </button>
      </div>
    </div>
  );
}
