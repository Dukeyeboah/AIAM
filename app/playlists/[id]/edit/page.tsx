'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, X, Check, ArrowLeft } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

export default function EditPlaylistPage() {
  const params = useParams();
  const playlistId = params.id as string;
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { affirmations, loading } = useUserAffirmations();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playlistName, setPlaylistName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(true);

  // Load existing playlist data
  useEffect(() => {
    const loadPlaylist = async () => {
      if (!user || !playlistId) return;

      try {
        const playlistRef = doc(
          firebaseDb,
          'users',
          user.uid,
          'playlists',
          playlistId
        );
        const snapshot = await getDoc(playlistRef);

        if (!snapshot.exists()) {
          toast({
            title: 'Playlist not found',
            description: 'This playlist does not exist.',
            variant: 'destructive',
          });
          router.push('/playlists');
          return;
        }

        const data = snapshot.data();
        setPlaylistName(data.name || '');
        setSelectedIds(new Set(data.affirmationIds || []));
      } catch (error) {
        console.error('[edit-playlist] Failed to load playlist', error);
        toast({
          title: 'Failed to load playlist',
          description: 'Unable to load the playlist. Please try again.',
          variant: 'destructive',
        });
        router.push('/playlists');
      } finally {
        setLoadingPlaylist(false);
      }
    };

    if (user && playlistId) {
      void loadPlaylist();
    }
  }, [user, playlistId, router, toast]);

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

  const handleSave = async () => {
    if (!user || !playlistId) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to edit playlists.',
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

    setIsSaving(true);
    try {
      const playlistRef = doc(
        firebaseDb,
        'users',
        user.uid,
        'playlists',
        playlistId
      );
      await updateDoc(playlistRef, {
        name: playlistName.trim(),
        affirmationIds: Array.from(selectedIds),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Playlist updated',
        description: `"${playlistName.trim()}" has been updated successfully.`,
      });

      router.push('/playlists');
    } catch (error) {
      console.error('[edit-playlist] Failed to update playlist', error);
      toast({
        title: 'Failed to update playlist',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to update the playlist. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out affirmations already in the playlist
  const availableAffirmations = useMemo(() => {
    return affirmations.filter((aff) => !selectedIds.has(aff.id));
  }, [affirmations, selectedIds]);

  // Get selected affirmations
  const selectedAffirmations = useMemo(() => {
    return affirmations.filter((aff) => selectedIds.has(aff.id));
  }, [affirmations, selectedIds]);

  if (authLoading || loadingPlaylist) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Edit Playlist</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Edit Playlist</CardTitle>
            <CardDescription>Sign in to edit playlists.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-6xl px-6 py-8 space-y-6'>
      <div className='flex items-center gap-4'>
        <Button
          variant='ghost'
          size='icon'
          className='cursor-pointer'
          onClick={() => router.push('/playlists')}
          title='Back to Playlists'
        >
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div>
          <h1 className='text-3xl font-semibold'>Edit Playlist</h1>
          <p className='text-muted-foreground'>
            Add or remove affirmations from your playlist.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Playlist Details</CardTitle>
          <CardDescription>
            Update your playlist name and select affirmations.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='playlist-name'>Playlist Name</Label>
            <Input
              id='playlist-name'
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder='My Affirmation Playlist'
            />
          </div>

          <div className='flex items-center justify-between pt-4'>
            <div className='text-sm text-muted-foreground'>
              {selectedIds.size} affirmation
              {selectedIds.size === 1 ? '' : 's'} selected
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !playlistName.trim()}
              className='cursor-pointer'
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className='h-64 rounded-lg' />
          ))}
        </div>
      ) : (
        <>
          {selectedAffirmations.length > 0 && (
            <div className='space-y-4'>
              <h2 className='text-xl font-semibold'>
                Selected Affirmations ({selectedAffirmations.length})
              </h2>
              <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
                {selectedAffirmations.map((affirmation) => (
                  <div key={affirmation.id} className='relative'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 hover:bg-destructive/80'
                      onClick={() => toggleSelection(affirmation.id)}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                    <UserAffirmationCard
                      affirmation={affirmation}
                      showFavoriteBadge={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='space-y-4'>
            <h2 className='text-xl font-semibold'>
              Available Affirmations ({availableAffirmations.length})
            </h2>
            {availableAffirmations.length === 0 ? (
              <Card className='bg-muted/30'>
                <div className='flex flex-col items-center justify-center gap-4 py-16 text-center'>
                  <p className='text-muted-foreground'>
                    All your affirmations are already in this playlist.
                  </p>
                </div>
              </Card>
            ) : (
              <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
                {availableAffirmations.map((affirmation) => (
                  <div key={affirmation.id} className='relative'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 hover:bg-primary/80'
                      onClick={() => toggleSelection(affirmation.id)}
                    >
                      <Plus className='h-4 w-4' />
                    </Button>
                    <UserAffirmationCard
                      affirmation={affirmation}
                      showFavoriteBadge={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
