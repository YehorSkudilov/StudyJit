'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { UserCircle, LogOut, Settings, Mail, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/api';

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-2 text-white shadow-md transition hover:scale-105 active:scale-95"
      >
        <UserCircle size={22} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 mt-2 w-56 card p-1.5 z-[3000]"
          >
            <MenuItem href="/profile" icon={<UserCircle size={18} />} text="Profile" onClick={() => setOpen(false)} />
            <MenuItem href="/settings" icon={<Settings size={18} />} text="Settings" onClick={() => setOpen(false)} />
            <MenuItem href="/contact" icon={<Mail size={18} />} text="Contact" onClick={() => setOpen(false)} />
            <MenuItem href="/about" icon={<Info size={18} />} text="About" onClick={() => setOpen(false)} />
            <hr className="border-stroke my-1.5" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
            >
              <LogOut size={18} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ href, icon, text, onClick }: { href: string; icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground transition"
    >
      {icon} {text}
    </Link>
  );
}
