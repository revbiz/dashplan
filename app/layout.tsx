import type { ReactNode } from 'react';

import './globals.css';

import TopNav from '@/app/components/top-nav';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en'>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
