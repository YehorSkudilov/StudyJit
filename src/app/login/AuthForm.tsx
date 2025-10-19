"use client";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    bio: "",
    currentPassword: "",
    newPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ✅ Fetch user profile on mount
  useEffect(() => {
    console.log("=== ProfilePage: Starting profile fetch ===");

    (async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const data = await res.json();
          console.log("✅ Profile data received:", data);

          setProfile((prev) => ({
            ...prev,
            name: data.name || "",
            email: data.email || "",
            bio: data.bio || "",
          }));
        } else {
          const error = await res.json().catch(() => ({}));
          console.error("❌ Error fetching profile:", error);
          setMessage({ type: "error", text: error.error || "Failed to load profile" });
        }
      } catch (err: any) {
        console.error("❌❌❌ Fetch error:", err);
        setMessage({ type: "error", text: "Network error while loading profile" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Handle form submission (profile + password)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== ProfilePage: Starting profile update ===");

    setSaving(true);
    setMessage(null);

    // 🔐 Local validation
    if (profile.newPassword && profile.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "New password must be at least 6 characters long.",
      });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const data = await res.json().catch(() => ({}));
      console.log("Update response data:", data);

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Profile updated successfully!" });
        setProfile((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
        }));
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile" });
      }
    } catch (err: any) {
      console.error("❌ Update error:", err);
      setMessage({ type: "error", text: "Network error while saving profile" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6 py-12">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-2xl">
        <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-6 text-center">
          Your Profile
        </h2>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              required
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 dark:border-gray-600 pt-6 mt-6" />

          {/* Change Password */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Change Password</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-2">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={profile.currentPassword}
                  onChange={(e) =>
                    setProfile({ ...profile, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={profile.newPassword}
                  onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 
                    3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
