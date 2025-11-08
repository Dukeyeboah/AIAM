'use client';

import type { ReactNode } from 'react';

import { AppHeader } from '@/components/app-header';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className='pt-24'>{children}</div>
    </>
  );
}
