"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSignedIn } from "@/lib/api";
import AuthForm from "./AuthForm";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn()) router.replace("/learningSpace");
  }, [router]);

  return <AuthForm />;
}
