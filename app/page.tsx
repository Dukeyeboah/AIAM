'use client';

import { useEffect, useMemo, useState } from 'react';

import { CategoryGrid } from '@/components/category-grid';
import { BackgroundAnimation } from '@/components/background-animation';
import { SplashScreen } from '@/components/splash-screen';
import { useAuth } from '@/providers/auth-provider';
import { useAuthModal } from '@/providers/auth-modal-provider';

export default function Home() {
  const { user, profile, initializing } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [splashComplete, setSplashComplete] = useState(false);

  const showAuthCta = useMemo(
    () => !initializing && !user,
    [initializing, user]
  );

  useEffect(() => {
    if (splashComplete && showAuthCta) {
      openAuthModal();
    }
  }, [splashComplete, showAuthCta, openAuthModal]);

  const firstName = useMemo(() => {
    if (!profile?.displayName) return null;
    return profile.displayName.trim().split(/\s+/)[0];
  }, [profile?.displayName]);

  return (
    <SplashScreen
      duration={5000}
      showCta={showAuthCta}
      onCtaClick={openAuthModal}
      persistKey='aiam-splash-shown'
      onComplete={() => setSplashComplete(true)}
    >
      <main className='relative min-h-screen overflow-hidden bg-gray-80'>
        <BackgroundAnimation />

        <div className='container relative z-10 mx-auto px-4 pb-10'>
          <div className='flex flex-col items-center justify-center pb-10 text-center md:pt-0'>
            {firstName && (
              <p className='mt-0 text-sm text-muted-foreground'>
                Welcome back, {firstName}!
              </p>
            )}
            <p className='max-w-2xl text-lg text-gray-600'>
              Generate personalized affirmations to nurture your mind, body, and
              soul.
            </p>
          </div>

          <CategoryGrid />
        </div>
      </main>
    </SplashScreen>
  );
}
