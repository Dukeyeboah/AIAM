'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  children: React.ReactNode;
  duration?: number;
}

export function SplashScreen({ children, duration = 4500 }: SplashScreenProps) {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setComplete(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <>
      {!complete && (
        <div className='fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background'>
          {/* <Image
            src='/images/aiam_logo_blk.png'
            alt='AiAm'
            width={320}
            height={320}
            className='h-22 w-auto animate-float'
            priority
          /> */}
          <Image
            src='/images/aiam_textlogo_blk.png'
            alt='AiAm'
            width={320}
            height={120}
            className='h-12 w-auto animate-float'
            priority
          />
        </div>
      )}
      <div
        className={cn(
          'transition-opacity duration-500',
          complete ? 'opacity-100' : 'opacity-0 pointer-events-none select-none'
        )}
      >
        {children}
      </div>
    </>
  );
}
