"use client";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pages without the Navbar: the landing page and sign-in have their own, and study sessions take the whole screen.
const NAVBAR_EXCLUDED_PAGES = ["/login", "/study"];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const shouldShowNavbar =
    pathname !== "/" &&
    !NAVBAR_EXCLUDED_PAGES.some((excludedPath) => pathname === excludedPath || pathname?.startsWith(`${excludedPath}/`));

  return (
    <html lang="en">
      <head>
        <title>StudyJit · Learn smarter with AI</title>
        <meta
          name="description"
          content="Turn your notes into quizzes, flashcards, matching games and study guides, made by AI."
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {shouldShowNavbar && <Navbar />}

        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
