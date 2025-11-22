'use client';

import { useMemo, useState } from 'react';
import {
  Loader2,
  LogOut,
  Bookmark,
  Settings,
  Coins,
  LayoutDashboard,
  Info,
  Home,
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
import { AboutAiamDialog } from '@/components/about-aiam-dialog';

export function UserMenu() {
  const { profile, signOutUser, authLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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

  const closeMenu = () => setMenuOpen(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
    } finally {
      setSigningOut(false);
      closeMenu();
    }
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='hover:shadow-gray-800 hover:border-blue-200 flex items-center gap-3 rounded-full px-2 py-6 my-2 cursor-pointer focus-visible:ring-none focus-visible:ring-offset-0 hover:shadow-sm hover:bg-transparenttransition-all duration-300'
          disabled={authLoading}
        >
          <div className='flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 border border-border/50'>
            <span className='text-xs font-semibold text-foreground'>
              {profile.credits ?? 0}
            </span>
            <span className='text-xs text-muted-foreground'>aiams</span>
          </div>
          <Avatar className='h-10 w-10 border-transparent transition '>
            {profile.photoURL ? (
              <AvatarImage
                src={profile.photoURL}
                alt={profile.displayName}
                className='object-cover'
              />
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
            closeMenu();
          }}
        >
          <span className='flex items-center gap-2'>
            <Coins className='h-4 w-4 text-amber-500' />
            Aiams
          </span>
          <span className='font-semibold'>{profile.credits ?? 0}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/');
            closeMenu();
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Home className='h-4 w-4' />
          Home
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/dashboard');
            closeMenu();
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <LayoutDashboard className='h-4 w-4' />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/saved');
            closeMenu();
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Bookmark className='h-4 w-4' />
          Saved affirmations
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            router.push('/account');
            closeMenu();
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Settings className='h-4 w-4' />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setAboutOpen(true);
            closeMenu();
          }}
          className='flex items-center gap-2 cursor-pointer'
        >
          <Info className='h-4 w-4' />
          About aiam
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
      <AboutAiamDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </DropdownMenu>
  );
}
