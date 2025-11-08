'use client';

import { useMemo, useState } from 'react';
import {
  Loader2,
  LogOut,
  Bookmark,
  Settings,
  Coins,
  LayoutDashboard,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';

export function UserMenu() {
  const { profile, signOutUser, authLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const initials = useMemo(() => {
    const fromDisplayName = profile?.displayName
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase();
    if (fromDisplayName) return fromDisplayName;
    const fromEmail = profile?.email?.charAt(0)?.toUpperCase();
    if (fromEmail) return fromEmail;
    return 'A';
  }, [profile?.displayName, profile?.email]);

  if (!profile) {
    return null;
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className=' shadow-none border-none flex items-center gap-3 rounded-full px-0 my-2 cursor-pointer focus-visible:ring-none focus-visible:ring-offset-0 hover:shadow-none'
          disabled={authLoading}
        >
          <Avatar className='h-8 w-8 border-none border-transparent transition hover:shadow-none'>
            {profile.photoURL ? (
              <AvatarImage src={profile.photoURL} alt={profile.displayName} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuLabel className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>
            {profile.displayName ?? 'AiAm Friend'}
          </span>
          <span className='text-xs text-muted-foreground'>
            {profile.email ?? 'Signed in'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='flex items-center justify-between text-sm cursor-pointer'
          onSelect={(event) => {
            event.preventDefault();
            router.push('/account?purchase=credits');
          }}
        >
          <span className='flex items-center gap-2'>
            <Coins className='h-4 w-4 text-amber-500' />
            Credits
          </span>
          <span className='font-semibold'>{profile.credits}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/saved');
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Bookmark className='h-4 w-4' />
          Saved affirmations
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/dashboard');
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <LayoutDashboard className='h-4 w-4' />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/account');
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Settings className='h-4 w-4' />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            if (!signingOut) {
              handleSignOut();
            }
          }}
          className='flex items-center gap-2 text-destructive cursor-pointer'
        >
          {signingOut ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <LogOut className='h-4 w-4' />
          )}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
