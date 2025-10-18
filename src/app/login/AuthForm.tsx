"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function AuthForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState(""); // NEW
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || (isRegister && !confirmPassword) || (isRegister && !name)) {
      setError("Please fill out all required fields.");
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
          body: JSON.stringify({ name, email, password }), // send name
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registration failed");
          return;
        }
      }

      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        const messages: Record<string, string> = {
          CredentialsSignin: "Invalid email or password",
          USER_NOT_FOUND: "User does not exist",
          INVALID_PASSWORD: "Incorrect password",
          MISSING_CREDENTIALS: "Please enter email and password",
        };
        setError(messages[res.error] || res.error);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Server error");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-6 bg-white text-black rounded shadow">
        <Image
          src="/images/logo.png"
          alt="BudgetBuddy Logo"
          width={60}
          height={60}
          className="mb-2 mx-auto"
        />
        <h1 className="mb-6 text-3xl font-semibold text-center">
          {isRegister ? "Register" : "Login"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-2 text-sm text-red-700 bg-red-100 rounded">{error}</div>}

          {isRegister && (
            <div>
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          )}

          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {isRegister && (
            <div>
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 mt-2 font-semibold text-white bg-black rounded hover:bg-green-600 transition hover:cursor-pointer"
          >
            {isRegister ? "Register" : "Log In"}
          </button>
        </form>

        <div className="mt-4 text-center">
          {isRegister ? (
            <p>
              Already have an account?{" "}
              <button type="button" onClick={() => setIsRegister(false)} className="text-green-600 hover:cursor-pointer underline">
                Log In
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setIsRegister(true)} className="text-green-600 hover:cursor-pointer underline">
                Register
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
