'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

const STORAGE_KEY = 'aiam-welcome-dismissed';

export function WelcomeDialog() {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile || !user) return;

    const hasSeenWelcome =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (hasSeenWelcome === 'true') {
      return;
    }

    // Show welcome dialog for new users
    setOpen(true);
  }, [profile, user]);

  const handleBegin = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
    // Trigger demographics dialog check after a short delay
    setTimeout(() => {
      window.dispatchEvent(new Event('welcome-dismissed'));
    }, 100);
  };

  if (!profile || !user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-lg sm:w-full space-y-6'>
        <DialogHeader>
          <DialogTitle className='text-2xl flex justify-center'>
            Welcome to aiam ✨
          </DialogTitle>
          <DialogDescription className='text-base leading-relaxed pt-2'>
            <p className='mb-4'>
              aiam helps you consciously reprogram your subconscious mind
              through <strong>affirmations</strong>,{' '}
              <strong>visualization</strong>, and{' '}
              <strong>your own voice</strong>.
            </p>
            <p className='mb-4 italic text-foreground/90'>
              Every "I am" you speak is a command to your reality — a vibration
              that shapes your future.
            </p>
            <p className='mb-4'>
              Use aiam to design affirmations that reflect the person you wish
              to become.. Visualize your future self, and imprint it deeply
              through repetition, positive emotion, unshakable conviction and
              resolute knowing that it is already done.
            </p>
            <p className='mb-4'>
              The more you feel and know it to be true without doubt, the faster
              your subconscious aligns to it — and the reality follows.
            </p>
            <p className='font-semibold text-foreground'>
              You are the creator.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className='flex justify-center '>
          <Button
            onClick={handleBegin}
            size='lg'
            className='gap-2 cursor-pointer'
          >
            Let's begin 🌱
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
