'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Play,
  Trash2,
  MoreVertical,
  ArrowLeft,
  Download,
  Music,
  Image,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';

export default function PlaylistsPage() {
  const { user, authLoading, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { playlists, loading } = usePlaylists();
  const { affirmations } = useUserAffirmations();
  const [downloadingPlaylistId, setDownloadingPlaylistId] = useState<
    string | null
  >(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadPlaylistId, setDownloadPlaylistId] = useState<string | null>(
    null
  );
  const [selectedVoiceForDownload, setSelectedVoiceForDownload] =
    useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);

  // Load voices for download
  useEffect(() => {
    const fetchVoices = async () => {
      setLoadingVoices(true);
      try {
        const response = await fetch('/api/voices');
        if (!response.ok) throw new Error('Unable to load voices');
        const data = await response.json();
        const options =
          data.voices?.map((voice: any) => ({
            id: voice.voice_id ?? voice.id,
            name: voice.name,
            description: voice.description ?? voice.labels?.description ?? '',
          })) ?? [];

        // Add cloned voice option if available
        if (profile?.voiceCloneId) {
          options.unshift({
            id: profile.voiceCloneId,
            name: profile.voiceCloneName ?? 'Your Voice',
            description: 'Your personal cloned voice',
          });
        }

        setVoices(options);
        // Set default voice
        if (options.length > 0 && !selectedVoiceForDownload) {
          if (profile?.voiceCloneId) {
            setSelectedVoiceForDownload(profile.voiceCloneId);
          } else {
            setSelectedVoiceForDownload(options[0].id);
          }
        }
      } catch (error) {
        console.error('[playlists] Failed to load voices', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    if (user) {
      void fetchVoices();
    }
  }, [
    user,
    profile?.voiceCloneId,
    profile?.voiceCloneName,
    selectedVoiceForDownload,
  ]);

  // Check if all affirmations in a playlist have cached audio for a voice
  const checkPlaylistAudioReady = (
    playlistId: string,
    voiceId: string
  ): boolean => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;

    const playlistAffirmations = affirmations.filter((aff) =>
      playlist.affirmationIds.includes(aff.id)
    );

    if (playlistAffirmations.length === 0) return false;

    // Check if all affirmations have cached audio for this voice
    return playlistAffirmations.every((aff) => {
      const audioUrls = aff.audioUrls || {};
      return !!audioUrls[voiceId];
    });
  };

  const handleDownloadClick = (playlistId: string) => {
    if (!selectedVoiceForDownload) {
      toast({
        title: 'Select a voice',
        description: 'Please select a voice before downloading.',
        variant: 'destructive',
      });
      return;
    }

    const isReady = checkPlaylistAudioReady(
      playlistId,
      selectedVoiceForDownload
    );
    if (!isReady) {
      setDownloadPlaylistId(playlistId);
      setDownloadDialogOpen(true);
      return;
    }

    void handleDownload(playlistId, selectedVoiceForDownload);
  };

  const handleDownload = async (playlistId: string, voiceId: string) => {
    if (!user) return;

    setDownloadingPlaylistId(playlistId);

    // Show loading toast
    const loadingToast = toast({
      title: 'Preparing download...',
      description: 'Combining audio files. This may take a moment.',
    });

    try {
      const response = await fetch('/api/playlist/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          playlistId,
          voiceId,
          withMusic: false,
          withImages: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'Not all affirmations have cached audio') {
          setDownloadPlaylistId(playlistId);
          setDownloadDialogOpen(true);
          return;
        }
        throw new Error(data.error || 'Failed to download playlist');
      }

      // Get the playlist name for the filename
      const playlist = playlists.find((p) => p.id === playlistId);
      const playlistName = playlist?.name || 'playlist';
      const fileName = `${playlistName.replace(
        /[^a-z0-9]/gi,
        '_'
      )}_${voiceId}.mp3`;

      // Create blob from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download complete',
        description: 'Your playlist audio has been downloaded.',
      });
    } catch (error) {
      console.error('[playlists] Download failed', error);
      toast({
        title: 'Download failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to download the playlist. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPlaylistId(null);
    }
  };

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
            <CardDescription>Loading...</CardDescription>
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
                        router.push(`/playlists/${playlist.id}/edit`);
                      }}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Edit Playlist
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadClick(playlist.id);
                      }}
                      disabled={downloadingPlaylistId === playlist.id}
                    >
                      <Download className='mr-2 h-4 w-4' />
                      {downloadingPlaylistId === playlist.id
                        ? 'Downloading...'
                        : 'Download playlist'}
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
