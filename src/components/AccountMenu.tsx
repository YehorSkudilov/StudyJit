'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle, LogOut, Settings, Mail, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

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
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 transition shadow-md"
      >
        <UserCircle size={22} className="text-gray-100 group-hover:text-white transition" />
      </button>

      {open && (
<div
  className="fixed right-4 top-16 w-52 rounded-xl border border-gray-700/40 dark:border-gray-300/30
             bg-white dark:bg-gray-900 shadow-[0_4px_18px_rgba(0,0,0,0.2)] overflow-hidden z-[3000]"
>

          <div className="py-1 text-sm">
            <MenuItem href="/profile" icon={<UserCircle size={18} />} text="Profile" />
            <MenuItem href="/settings" icon={<Settings size={18} />} text="Settings" />
            <MenuItem href="/contact" icon={<Mail size={18} />} text="Contact" />
            <MenuItem href="/about" icon={<Info size={18} />} text="About" />

            {/* Divider uses same tone as text */}
            <hr className="border-gray-700/40 dark:border-gray-300/30 my-1" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, icon, text }: { href: string; icon: React.ReactNode; text: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
    >
      {icon} {text}
    </a>
  );
}
