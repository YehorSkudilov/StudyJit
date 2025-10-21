'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import AccountMenu from '@/components/AccountMenu';
import Image from 'next/image';

const tabs = [
  { href: '/learningSpace', label: 'LearningSpace' },
  { href: '/files', label: 'Files' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href;

  return (
    <nav className="w-full bg-[#0C1323] border-b border-gray-700 shadow-sm text-white z-[5000]">
      <div className="relative mx-auto h-16 px-6 flex items-center justify-between">
        {/* Logo - Far Left */}
        <div className="absolute left-6 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="Logo" width={38} height={38} />
            <span className="text-xl font-bold text-white">Study Jit</span>
          </Link>
        </div>

        {/* Center Tabs */}
        <ul className="hidden md:flex gap-2 font-medium mx-auto">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`px-4 py-2 rounded-md transition ${
                  isActive(tab.href)
                    ? 'bg-white text-black font-semibold'
                    : 'text-gray-200 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right - Profile + Mobile Menu */}
        <div className="absolute right-6 flex items-center gap-4">
                      
          <button
            className="md:hidden text-gray-300 hover:text-white transition"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>

<AccountMenu />
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 font-medium bg-[#0C1323] border-t border-gray-700">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2 rounded-md transition ${
                  isActive(tab.href)
                    ? 'bg-white text-black font-semibold'
                    : 'text-gray-200 hover:bg-white/10'
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
