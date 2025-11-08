'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  children: React.ReactNode;
  duration?: number;
  onComplete?: () => void;
  showCta?: boolean;
  ctaLabel?: string;
  onCtaClick?: () => void;
  persistKey?: string;
}

export function SplashScreen({
  children,
  duration = 4500,
  onComplete,
  showCta = false,
  ctaLabel = 'I AM',
  onCtaClick,
  persistKey,
}: SplashScreenProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const hasNotifiedRef = useRef(false);

  const notifyComplete = useCallback(() => {
    if (hasNotifiedRef.current) {
      return;
    }
    hasNotifiedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!persistKey) {
      setOverlayVisible(true);
      setOverlayHidden(false);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const hasSeenSplash = window.sessionStorage.getItem(persistKey);
    if (hasSeenSplash) {
      setOverlayVisible(false);
      setOverlayHidden(true);
      notifyComplete();
    } else {
      setOverlayVisible(true);
      setOverlayHidden(false);
    }
  }, [persistKey, notifyComplete]);

  useEffect(() => {
    if (!overlayVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setOverlayHidden(true);
      if (persistKey && typeof window !== 'undefined') {
        window.sessionStorage.setItem(persistKey, 'true');
      }
      notifyComplete();
      const removalDelay = setTimeout(() => {
        setOverlayVisible(false);
      }, 400);
      return () => clearTimeout(removalDelay);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, notifyComplete, overlayVisible, persistKey]);

  return (
    <>
      {overlayVisible && (
        <div
          className={cn(
            'fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-500',
            overlayHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
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
          {showCta && (
            <button
              type='button'
              onClick={onCtaClick}
              className='rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary'
            >
              {ctaLabel}
            </button>
          )}
        </div>
      )}
      <div className='relative z-0'>{children}</div>
    </>
  );
}
