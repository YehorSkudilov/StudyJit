"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { register, signIn, signUpEnabled } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Lock, Mail, User } from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function AuthForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canRegister, setCanRegister] = useState(true);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // An admin can close sign-up; then accounts are only made from the admin site.
  useEffect(() => {
    signUpEnabled().then((enabled) => {
      setCanRegister(enabled);
      if (!enabled) setIsRegister(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!email || !password || (isRegister && !confirmPassword) || (isRegister && !name)) {
      setError("Please fill out all required fields.");
      return;
    }

    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (isRegister) await register(name, email, password);
      else await signIn(email, password);
      router.push("/learningSpace");
    } catch (err) {
      setError(err instanceof TypeError ? "Couldn't reach the server. Please try again." : (err as Error).message);
      setBusy(false);
    }
  };

  const field = (
    key: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }
  ) => {
    const { icon, ...rest } = props;
    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="relative"
      >
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
        <input {...rest} className="input pl-11" />
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b2a5c] via-brand to-brand-2 p-12 text-white">
        <div className="animate-drift absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="animate-drift absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl [animation-delay:-8s]" />
        <Link href="/" className="relative">
          <Logo size={40} light />
        </Link>
        <div className="relative">
          <Image src="/images/logo-square.png" alt="" width={180} height={180} className="animate-float mb-8 drop-shadow-2xl" />
          <h1 className="text-4xl font-extrabold leading-tight">Learn smarter,<br />not longer.</h1>
          <p className="mt-4 text-white/80 text-lg max-w-md">
            Quizzes, flashcards, matching games and study guides, built from your own notes.
          </p>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} StudyJit</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link href="/" className="lg:hidden flex justify-center mb-8">
            <Logo size={44} />
          </Link>

          <AnimatePresence mode="wait">
            <motion.div
              key={isRegister ? "register" : "login"}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-3xl font-extrabold tracking-tight">
                {isRegister ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-2 text-muted">
                {isRegister ? "Start turning your notes into study sets." : "Log in to pick up where you left off."}
              </p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {isRegister &&
                field("name", {
                  icon: <User className="w-4 h-4" />,
                  type: "text",
                  placeholder: "Full name",
                  autoComplete: "name",
                  value: name,
                  onChange: (e) => setName(e.target.value),
                })}
              {field("email", {
                icon: <Mail className="w-4 h-4" />,
                type: "email",
                placeholder: "Email address",
                autoComplete: "email",
                value: email,
                onChange: (e) => setEmail(e.target.value),
              })}
              {field("password", {
                icon: <Lock className="w-4 h-4" />,
                type: "password",
                placeholder: "Password",
                autoComplete: isRegister ? "new-password" : "current-password",
                minLength: 8,
                value: password,
                onChange: (e) => setPassword(e.target.value),
              })}
              {isRegister &&
                field("confirm", {
                  icon: <Lock className="w-4 h-4" />,
                  type: "password",
                  placeholder: "Confirm password",
                  autoComplete: "new-password",
                  value: confirmPassword,
                  onChange: (e) => setConfirmPassword(e.target.value),
                })}
            </AnimatePresence>

            <button type="submit" className="btn-primary w-full py-3 mt-2 text-base" disabled={busy}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : isRegister ? "Create account" : "Log in"}
            </button>
          </form>

          {canRegister ? (
            <p className="mt-6 text-center text-muted">
              {isRegister ? "Already have an account? " : "New to StudyJit? "}
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="font-semibold text-brand hover:underline"
              >
                {isRegister ? "Log in" : "Create an account"}
              </button>
            </p>
          ) : (
            <p className="mt-6 text-center text-muted">Sign-up is closed. Ask an admin for an account.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
