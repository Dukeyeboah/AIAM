'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';
import { UserAffirmationCard } from '@/components/user-affirmation-card';
import { firebaseDb } from '@/lib/firebase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatePlaylistPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { affirmations, loading } = useUserAffirmations();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlistName, setPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create playlists.',
        variant: 'destructive',
      });
      return;
    }

    if (!playlistName.trim()) {
      toast({
        title: 'Playlist name required',
        description: 'Please enter a name for your playlist.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedIds.size === 0) {
      toast({
        title: 'Select affirmations',
        description:
          'Please select at least one affirmation for your playlist.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const playlistRef = collection(
        firebaseDb,
        'users',
        user.uid,
        'playlists'
      );
      await addDoc(playlistRef, {
        name: playlistName.trim(),
        affirmationIds: Array.from(selectedIds),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Playlist created',
        description: `"${playlistName.trim()}" has been created successfully.`,
      });

      router.push('/playlists');
    } catch (error) {
      console.error('[create-playlist] Failed to create playlist', error);
      toast({
        title: 'Failed to create playlist',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to create the playlist. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Create Playlist</CardTitle>
            <CardDescription>
              Sign in to create custom affirmation playlists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-6xl px-6 py-8 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-semibold'>Create Playlist</h1>
          <p className='text-muted-foreground'>
            Select affirmations to include in your playlist.
          </p>
        </div>
        <Button variant='outline' onClick={() => router.push('/playlists')}>
          <X className='mr-2 h-4 w-4' />
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Playlist Details</CardTitle>
          <CardDescription>
            Give your playlist a name to help you identify it later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <Label htmlFor='playlist-name'>Playlist Name</Label>
            <Input
              id='playlist-name'
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder='e.g., Morning Motivation'
              maxLength={50}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Select Affirmations</CardTitle>
              <CardDescription>
                {selectedIds.size > 0
                  ? `${selectedIds.size} affirmation${
                      selectedIds.size === 1 ? '' : 's'
                    } selected`
                  : 'Click on affirmations to add them to your playlist.'}
              </CardDescription>
            </div>
            <Button
              onClick={handleCreate}
              disabled={
                isCreating || selectedIds.size === 0 || !playlistName.trim()
              }
              className='flex items-center gap-2'
            >
              {isCreating ? (
                <>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className='h-4 w-4' />
                  Create Playlist
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='grid gap-6 grid-cols-1 md:grid-cols-2'>
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className='h-64 rounded-2xl' />
              ))}
            </div>
          ) : affirmations.length === 0 ? (
            <Card className='bg-muted/30'>
              <div className='flex flex-col items-center justify-center gap-4 py-16 text-center'>
                <p className='text-muted-foreground'>
                  No affirmations available. Generate some affirmations first.
                </p>
              </div>
            </Card>
          ) : (
            <div className='grid gap-6 grid-cols-1 md:grid-cols-2'>
              {affirmations.map((affirmation) => {
                const isSelected = selectedIds.has(affirmation.id);
                return (
                  <div key={affirmation.id} className='relative'>
                    <div
                      className={`absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-background/80 border-border backdrop-blur-sm hover:bg-background'
                      }`}
                      onClick={() => toggleSelection(affirmation.id)}
                    >
                      {isSelected ? (
                        <Check className='h-5 w-5' />
                      ) : (
                        <Plus className='h-5 w-5' />
                      )}
                    </div>
                    <div
                      className={`cursor-pointer transition-opacity ${
                        isSelected
                          ? 'opacity-100'
                          : 'opacity-60 hover:opacity-80'
                      }`}
                      onClick={() => toggleSelection(affirmation.id)}
                    >
                      <UserAffirmationCard
                        affirmation={affirmation}
                        showFavoriteBadge={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
