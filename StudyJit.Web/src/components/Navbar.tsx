'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, FolderOpen, Menu, X } from 'lucide-react';
import AccountMenu from '@/components/AccountMenu';
import Logo from '@/components/ui/Logo';

const tabs = [
  { href: '/learningSpace', label: 'Learning Space', icon: BookOpen, also: ['/quizDetails'] },
  { href: '/files', label: 'Files', icon: FolderOpen, also: [] as string[] },
];

export default function Navbar() {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (tab: (typeof tabs)[number]) =>
    pathname === tab.href || tab.also.some((p) => pathname.startsWith(p));

  return (
    <nav className="sticky top-0 z-[5000] w-full border-b border-stroke/70 bg-surface/75 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link href="/learningSpace" className="flex items-center transition hover:opacity-80">
          <Logo size={34} />
        </Link>

        {/* Tabs, with a pill that slides to the active one */}
        <ul className="hidden md:flex items-center gap-1 rounded-full bg-surface-2 p-1">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <li key={tab.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-surface shadow-sm"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Link
                  href={tab.href}
                  className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    active ? 'text-brand' : 'text-muted hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <button
            className="icon-btn md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <AccountMenu />
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden px-4 border-t border-stroke"
          >
            {tabs.map((tab) => (
              <li key={tab.href} className="py-1 first:pt-3 last:pb-3">
                <Link
                  href={tab.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition ${
                    isActive(tab) ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </nav>
  );
}
