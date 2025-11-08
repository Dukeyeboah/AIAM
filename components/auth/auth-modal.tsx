'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Chrome, UserPlus, LogIn } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/auth-provider';

type AuthMode = 'signup' | 'login';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, authLoading } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'signup' ? 'Create your aiam account' : 'Welcome back'),
    [mode]
  );

  const description = useMemo(
    () =>
      mode === 'signup'
        ? 'Sign up to save your affirmations and start with 100 free credits.'
        : 'Log in to access your affirmations, credits, and personalized experience.',
    [mode]
  );

  useEffect(() => {
    if (!open) {
      setMode('signup');
      setFirstName('');
      setEmail('');
      setPassword('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === 'signup') {
        await signUpWithEmail({ email, password, firstName });
      } else {
        await signInWithEmail(email, password);
      }
      onOpenChange(false);
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : 'We could not complete that action. Please try again.';
      setError(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      onOpenChange(false);
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : 'We could not complete that action. Please try again.';
      setError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-full max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className='flex items-center justify-center gap-2 rounded-full bg-muted p-1 text-sm font-medium'>
          <button
            type='button'
            className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
              mode === 'signup'
                ? 'bg-background shadow-sm'
                : 'opacity-60 hover:opacity-100'
            }`}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            disabled={authLoading}
          >
            <UserPlus className='h-4 w-4' />
            I&apos;m new
          </button>
          <button
            type='button'
            className={`flex items-center gap-1 rounded-full px-3 py-1 transition ${
              mode === 'login'
                ? 'bg-background shadow-sm'
                : 'opacity-60 hover:opacity-100'
            }`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            disabled={authLoading}
          >
            <LogIn className='h-4 w-4' />
            I&apos;ve been here
          </button>
        </div>

        <div className='space-y-4'>
          <form className='space-y-4' onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className='space-y-2'>
                <Label htmlFor='first-name'>First name</Label>
                <Input
                  id='first-name'
                  name='firstName'
                  placeholder='AiAm'
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={authLoading}
                />
              </div>
            )}
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                name='email'
                type='email'
                placeholder='you@example.com'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={authLoading}
                autoComplete='email'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                name='password'
                type='password'
                placeholder='••••••••'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={authLoading}
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={6}
              />
            </div>

            {error && (
              <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                {error}
              </p>
            )}

            <Button
              type='submit'
              className='w-full'
              disabled={
                authLoading ||
                !email ||
                !password ||
                (mode === 'signup' && !firstName.trim())
              }
            >
              {authLoading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : mode === 'signup' ? (
                'Create account'
              ) : (
                'Log in'
              )}
            </Button>
          </form>

          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-border' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>
                or continue with
              </span>
            </div>
          </div>

          <Button
            type='button'
            variant='outline'
            className='w-full'
            onClick={handleGoogleSignIn}
            disabled={authLoading}
          >
            <Chrome className='mr-2 h-4 w-4' />
            Google
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
