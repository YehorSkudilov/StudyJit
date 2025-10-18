"use client";

import { useState } from "react";

export default function AppSettingsPage() {
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
    autoSync: false,
    locationAccess: true,
    language: "en",
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof prev[key] === "boolean" ? !prev[key] : prev[key],
    }));
  };

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings((prev) => ({
      ...prev,
      language: e.target.value,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Settings saved:\n" + JSON.stringify(settings, null, 2));
  };

  return (
    <main className=" w-1/2 mx-auto p-6 space-y-8 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">App Settings</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <ToggleSwitch
          id="darkMode"
          label="Dark Mode"
          checked={settings.darkMode}
          onChange={() => toggleSetting("darkMode")}
          textColor="text-white"
        />

        <ToggleSwitch
          id="notifications"
          label="Enable Notifications"
          checked={settings.notifications}
          onChange={() => toggleSetting("notifications")}
          textColor="text-white"
        />

        <ToggleSwitch
          id="autoSync"
          label="Auto Sync Data"
          checked={settings.autoSync}
          onChange={() => toggleSetting("autoSync")}
          textColor="text-white"
        />

        <ToggleSwitch
          id="locationAccess"
          label="Allow Location Access"
          checked={settings.locationAccess}
          onChange={() => toggleSetting("locationAccess")}
          textColor="text-white"
        />

        <div>
          <label htmlFor="language" className="block mb-2 font-semibold text-white">
            Language
          </label>
          <select
            id="language"
            value={settings.language}
            onChange={changeLanguage}
            className="w-full px-3 py-2 rounded border border-gray-600 bg-transparent text-white focus:outline-none focus:ring focus:ring-green-400"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Save Settings
        </button>
      </form>
    </main>
  );
}

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
  textColor = "text-white",
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  textColor?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center cursor-pointer select-none ${textColor}`}
    >
      <div className="relative">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${
            checked ? "bg-green-600" : "bg-gray-600"
          }`}
        />
        <div
          className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-300 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
      <span className="ml-3 font-medium">{label}</span>
    </label>
  );
}
