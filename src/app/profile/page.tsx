"use client";

import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    id: "",
    name: "",
    email: "",
    bio: "",
    avatar: "https://cdn-icons-png.flaticon.com/512/847/847969.png",
  });

 useEffect(() => {
  async function fetchProfile() {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setProfile((prev) => ({
        ...prev,
        ...data,
        bio: data.bio || ""   // <-- fix here
      }));
    }
  }
  fetchProfile();
}, []);


  const handleChange = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
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

    if (res.ok) {
      alert("Profile saved successfully!");
    } else {
      const data = await res.json();
      alert("Failed to save profile: " + data.error);
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while saving your profile.");
  }
};


  const handleChangeImage = () => {
    const newAvatar = prompt("Enter new image URL:");
    if (newAvatar) setProfile((prev) => ({ ...prev, avatar: newAvatar }));
  };

  return (
    <main className="flex items-start justify-center py-10 px-4">
      <div className="w-full md:w-[900px] bg-gray-800 rounded-2xl shadow-lg p-8 space-y-8">
        <h1 className="text-4xl font-bold text-center text-green-400">Your Profile</h1>

        {/* Avatar */}
        <div className="relative w-40 mx-auto">
          <img
            src={profile.avatar}
            alt="Profile Avatar"
            className="w-40 h-40 rounded-full object-cover border-4 border-green-600 shadow-md"
          />
          <button
            onClick={handleChangeImage}
            className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-500 text-white p-2 rounded-full shadow-lg transition"
            title="Change Avatar"
          >
            ✎
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col">
            <label htmlFor="name" className="mb-2 font-semibold text-gray-300">Name</label>
            <input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email" className="mb-2 font-semibold text-gray-300">Email</label>
            <input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="bio" className="mb-2 font-semibold text-gray-300">Bio</label>
            <textarea
              id="bio"
              rows={4}
              value={profile.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="Tell us a bit about yourself"
              className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-indigo-500 transition"
          >
            Save Profile
          </button>
        </form>
      </div>
    </main>
  );
}
