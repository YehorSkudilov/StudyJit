"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "", bio: "", avatar: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load user profile data on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          const err = await res.json();
          setMessage(`❌ ${err.error || "Failed to load profile"}`);
        }
      } catch {
        setMessage("❌ Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Save user profile
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          bio: profile.bio,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Profile saved successfully!");
      } else {
        setMessage(`❌ ${data.error || "Failed to update profile"}`);
      }
    } catch {
      setMessage("❌ Server error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-600 dark:text-gray-300">
        Loading your profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl text-center">
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

        {/* ✅ Page Title */}
        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6">
          Your Profile
        </h2>

        {/* ✅ Avatar */}
        <img
          src={profile.avatar || "/images/logo.png"}
          alt="Avatar"
          className="w-32 h-32 rounded-full mx-auto border-4 border-blue-500 dark:border-blue-400 mb-6 object-cover"
        />

        {/* ✅ Form */}
        <form onSubmit={handleSave} className="space-y-4">
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition"
          >
            Save Profile
          </button>
        </form>

        {message && (
          <div className="mt-4 text-sm text-center text-blue-600 dark:text-blue-400">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
