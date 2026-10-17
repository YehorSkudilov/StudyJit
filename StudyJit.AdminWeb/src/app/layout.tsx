import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const openSans = localFont({
  src: [
    { path: "../fonts/OpenSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/OpenSans-Semibold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudyJit admin",
  description: "StudyJit's admin: users, quizzes and quiz generation.",
  // Admins only: nothing here for search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0D12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={openSans.variable}>
      <body>{children}</body>
    </html>
  );
}
