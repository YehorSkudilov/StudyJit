'use client';

import { useState, useRef, useEffect } from 'react';
import { UserCircle, LogOut, Settings, Mail, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Close dropdown when clicking outside
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
    setOpen(false); // close the menu
    await signOut({ redirect: false }); // log out without redirect
    router.push('/login'); // navigate to login page manually
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
        <button
            onClick={() => setOpen(!open)}
            className="group hover:cursor-pointer flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
            >
            <UserCircle size={24} className="text-white group-hover:text-black transition" />
        </button>



      {open && (
        <div className="absolute right-0 z-10 mt-2 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <a
              href="/profile"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <UserCircle size={18} /> Profile
            </a>

            <a
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Settings size={18} /> Settings
            </a>

            <a
              href="/contact"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Mail size={18} /> Contact
            </a>

                        <a
              href="/about"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Info size={18} /> About
            </a>


            <button
              onClick={() => handleLogout()}
              className="w-full flex hover:cursor-pointer items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
