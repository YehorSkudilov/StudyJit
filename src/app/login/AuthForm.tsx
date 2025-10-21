"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function AuthForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!email || !password || (isRegister && !confirmPassword) || (isRegister && !name)) {
      setError("Please fill out all required fields.");
      return;
    }

    if (isRegister && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Registration failed");
          return;
        }
      }

      const res = await signIn("credentials", { redirect: false, email, password });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }

      router.push("/learningSpace");
    } catch (err) {
      setError("Server error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 px-6">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
        <Image
          src="/images/logo.png"
          alt="StudyBuddy Logo"
          width={100}
          height={100}
          className="mx-auto mb-4"
        />

        <h2 className="text-3xl font-bold text-center mb-6">
          {isRegister ? "Create Account" : "Welcome Back"}
        </h2>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded p-2 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {isRegister && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}

          <button
            type="submit"
            className="w-full py-3 font-semibold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
          >
            {isRegister ? "Register" : "Log In"}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600 dark:text-gray-300">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setIsRegister(false)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Log In
              </button>
            </>
          ) : (
            <>
              Don’t have an account?{" "}
              <button
                onClick={() => setIsRegister(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                Register
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}