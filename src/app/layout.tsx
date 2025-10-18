"use client";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pages where Navbar should NOT be shown
const NAVBAR_EXCLUDED_PAGES = [
  "/login",
  "/",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Check if current page should hide navbar
  const shouldShowNavbar = !NAVBAR_EXCLUDED_PAGES.some(
    (excludedPath) => pathname === excludedPath || pathname?.startsWith(`${excludedPath}/`)
  );

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Conditionally render Navbar */}
        {shouldShowNavbar && <Navbar />}

        {children}
      </body>
    </html>
  );
}