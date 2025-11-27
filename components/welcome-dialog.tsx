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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/providers/auth-provider';

const STORAGE_KEY = 'aiam-welcome-dismissed';

export function WelcomeDialog() {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

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
      if (dontShowAgain) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
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
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-lg sm:w-full flex flex-col max-h-[90vh] sm:max-h-[85vh]'>
        <DialogHeader>
          <DialogTitle className='text-2xl flex justify-center'>
            Welcome to aiam ✨
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className='flex-1 pr-4'>
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
            <p className='font-semibold text-foreground mb-4'>
              You are the creator.
            </p>
          </DialogDescription>
        </ScrollArea>
        <div className='flex flex-col gap-4 pt-4 border-t'>
          <div className='flex items-center space-x-2'>
            <Checkbox
              id='dont-show-again'
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label
              htmlFor='dont-show-again'
              className='text-sm font-normal cursor-pointer'
            >
              Don't show this again
            </Label>
          </div>
          <div className='flex justify-center'>
            <Button
              onClick={handleBegin}
              size='lg'
              className='gap-2 cursor-pointer'
            >
              Let's begin 🌱
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
