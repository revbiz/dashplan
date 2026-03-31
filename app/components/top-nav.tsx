'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      className={
        isActive
          ? 'rounded px-2 py-1 text-sm font-medium text-neutral-900 underline'
          : 'rounded px-2 py-1 text-sm text-neutral-700 hover:underline'
      }
      href={href}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className='sticky top-0 z-40 border-b bg-white/90 backdrop-blur'>
      <div className='mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3'>
        <div className='flex items-center gap-3'>
          <Link className='text-sm font-semibold' href='/'>
            Dashboard
          </Link>

          <nav className='hidden items-center gap-2 sm:flex'>
            <NavLink href='/dashboard' label='Dashboard' />
            <NavLink href='/preferences' label='Preferences' />
            <NavLink href='/charts' label='Charts' />
            <NavLink href='/reports-notetype' label='NoteType Report' />
            <NavLink href='/test' label='Test JSON' />
            <NavLink href='/logout' label='Logout' />
          </nav>
        </div>

        <div className='flex items-center gap-2'>
          <div className='hidden sm:block'>
            <NavLink href='/login' label='Login' />
          </div>

          <button
            className='inline-flex items-center rounded border bg-white px-3 py-2 text-sm font-medium sm:hidden'
            type='button'
            aria-expanded={open}
            aria-controls='mobile-nav'
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <div id='mobile-nav' className='border-t bg-white sm:hidden'>
          <div className='mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3'>
            <NavLink href='/dashboard' label='Dashboard' />
            <NavLink href='/preferences' label='Preferences' />
            <NavLink href='/charts' label='Charts' />
            <NavLink href='/reports-notetype' label='NoteType Report' />
            <NavLink href='/test' label='Test JSON' />
            <NavLink href='/login' label='Login' />
            <NavLink href='/logout' label='Logout' />
          </div>
        </div>
      ) : null}
    </header>
  );
}
