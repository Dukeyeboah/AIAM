'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/user-menu';
import { MusicPlayer } from '@/components/music-player';
import { useAuth } from '@/providers/auth-provider';
import { useAuthModal } from '@/providers/auth-modal-provider';

export function AppHeader() {
  const { user, initializing } = useAuth();
  const { open } = useAuthModal();

  const showAuthButton = useMemo(
    () => !initializing && !user,
    [initializing, user]
  );

  return (
    <header className='fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-background/70 px-4 py-0 backdrop-blur-lg transition-colors md:px-8'>
      <Link href='/' className='flex items-center gap-3'>
        <Image
          src='/images/aiam_textlogo_blk.png'
          alt='AiAm wordmark'
          width={112}
          height={24}
          priority
          className='h-6 w-auto cursor-pointer'
        />
      </Link>
      <div className='flex items-center gap-3'>
        <MusicPlayer />
        {showAuthButton ? (
          <Button
            variant='outline'
            className='rounded-full border-none focus-visible:ring-0 focus-visible:ring-offset-0'
            onClick={open}
          >
            <UserRound className='w-4 h-4' />
          </Button>
        ) : (
          <UserMenu />
        )}
      </div>
    </header>
  );
}
