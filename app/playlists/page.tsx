'use client';

import { useRouter } from 'next/navigation';
import { Plus, Play, Trash2, MoreVertical, ArrowLeft } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { usePlaylists } from '@/hooks/use-playlists';
import { firebaseDb } from '@/lib/firebase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlaylistsPage() {
  const { user, authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { playlists, loading } = usePlaylists();

  const handleDelete = async (playlistId: string, playlistName: string) => {
    if (!user) return;

    if (
      !confirm(
        `Are you sure you want to delete "${playlistName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const playlistRef = doc(
        firebaseDb,
        'users',
        user.uid,
        'playlists',
        playlistId
      );
      await deleteDoc(playlistRef);
      toast({
        title: 'Playlist deleted',
        description: `"${playlistName}" has been removed.`,
      });
    } catch (error) {
      console.error('[playlists] Failed to delete playlist', error);
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to delete the playlist. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Playlists</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Show sign-in prompt only if user is definitely not authenticated
  if (!user) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Playlists</CardTitle>
            <CardDescription>
              Sign in to view and manage your affirmation playlists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-6xl px-6 py-8 space-y-6'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='icon'
            className='cursor-pointer'
            onClick={() => router.push('/dashboard')}
            title='Back to Dashboard'
          >
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h1 className='text-3xl font-semibold'>Playlists</h1>
            <p className='text-muted-foreground'>
              Create and manage your custom affirmation playlists.
            </p>
          </div>
        </div>
        <Button
          className='cursor-pointer'
          onClick={() => router.push('/playlists/create')}
        >
          <Plus className='mr-2 h-4 w-4' />
          Create Playlist
        </Button>
      </div>

      {loading ? (
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className='h-32 rounded-lg' />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <Card className='bg-muted/30'>
          <div className='flex flex-col items-center justify-center gap-4 py-16 text-center'>
            <p className='text-muted-foreground'>
              No playlists yet. Create your first playlist to get started.
            </p>
            <Button
              className='cursor-pointer'
              onClick={() => router.push('/playlists/create')}
            >
              <Plus className='mr-2 h-4 w-4' />
              Create Playlist
            </Button>
          </div>
        </Card>
      ) : (
        <div className='grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className='cursor-pointer transition-shadow hover:shadow-lg'
              onClick={() => router.push(`/playlists/${playlist.id}`)}
            >
              <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-2'>
                <div className='flex-1'>
                  <CardTitle className='text-lg'>{playlist.name}</CardTitle>
                  <CardDescription>
                    {playlist.affirmationIds.length} affirmation
                    {playlist.affirmationIds.length === 1 ? '' : 's'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
                      <MoreVertical className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/playlists/${playlist.id}`);
                      }}
                    >
                      <Play className='mr-2 h-4 w-4' />
                      View & Play
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(playlist.id, playlist.name);
                      }}
                      className='text-destructive focus:text-destructive'
                    >
                      <Trash2 className='mr-2 h-4 w-4' />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
