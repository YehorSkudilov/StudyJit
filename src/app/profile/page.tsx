"use client";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "", bio: "", avatar: "" });

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    alert("Profile saved successfully!");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">Your Profile</h1>

        <div className="flex flex-col items-center mb-6">
          <img
            src={profile.avatar || "/images/logo.png"}
            alt="Avatar"
            className="w-32 h-32 rounded-full object-cover border-4 border-blue-500 shadow-md"
          />
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />

          <input
            type="email"
            placeholder="Email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />

          <textarea
            rows={4}
            placeholder="Bio"
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none"
          />

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Save Profile
          </button>
        </form>
      </div>
    </main>
  );
}
