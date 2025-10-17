'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import AccountMenu from '@/components/AccountMenu';
import Image from 'next/image';

const tabs = [
  { href: '/dashboard', label: 'Dashboard' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="w-full bg-gray-100 dark:bg-gray-900 border-b shadow-md text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center md:justify-center relative">
        {/* Left: Logo */}
      <Link href="/"  className="md:absolute left-4 flex items-center gap-2">
        <Image src="/images/logo.png" alt="Logo" width={35} height={35} />
        <span className="text-xl font-bold">
          Study Jit
        </span>
      </Link>
        {/* Center: Desktop Tabs */}
        <ul className="hidden md:flex gap-1 font-medium">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`px-4 py-2 rounded-md transition ${
                  isActive(tab.href)
                    ? 'bg-white text-black font-semibold'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right: Account Menu (desktop only) */}
        <div className="flex items-center absolute right-4 top-1/2 -translate-y-1/2">
        <AccountMenu/>
        </div>


        {/* Mobile Menu Button */}
        <div className="md:hidden absolute right-17 translate-y-1/10">
          <button onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Tabs */}
      {menuOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 font-medium">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2 rounded-md transition ${
                  isActive(tab.href)
                    ? 'bg-white text-black font-semibold'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
