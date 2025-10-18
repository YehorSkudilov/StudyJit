"use client";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "", bio: "", avatar: "" });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/users");
      if (res.ok) setProfile(await res.json());
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-6">Your Profile</h2>

        <img
          src={profile.avatar || "/images/logo.png"}
          alt="Avatar"
          className="w-32 h-32 rounded-full mx-auto border-4 border-blue-500 dark:border-blue-400 mb-6"
        />

        <form className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400"
          />

          <input
            type="email"
            placeholder="Email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400"
          />

          <textarea
            placeholder="Bio"
            rows={4}
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 resize-none"
          />

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition"
          >
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}
