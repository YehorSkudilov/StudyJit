"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isSignedIn } from "@/lib/api";

// Pages anyone may see; everything else needs a signed-in user.
const PUBLIC_PAGES = ["/", "/login"];

/** Sends signed-out visitors to /login. The API checks every call itself; this only saves showing empty pages. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PAGES.includes(pathname ?? "/");
  // The session is in the browser, so nothing is known while prerendering.
  const [allowed, setAllowed] = useState(isPublic);

  useEffect(() => {
    if (isPublic || isSignedIn()) setAllowed(true);
    else {
      setAllowed(false);
      router.replace("/login");
    }
  }, [isPublic, pathname, router]);

  return allowed ? <>{children}</> : null;
}
