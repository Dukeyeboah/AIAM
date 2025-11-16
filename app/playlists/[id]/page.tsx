'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Check,
} from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';
import { firebaseDb, firebaseStorage } from '@/lib/firebase/client';
import type { Playlist } from '@/hooks/use-playlists';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VOICE_CLONE_COST, hasEnoughCredits } from '@/lib/credit-utils';

export default function PlaylistViewPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const playlistId = params.id as string;
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; description?: string }>
  >([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { affirmations } = useUserAffirmations();

  // Filter affirmations to only those in the playlist
  const playlistAffirmations = affirmations.filter((aff) =>
    playlist?.affirmationIds.includes(aff.id)
  );

  const currentAffirmation = playlistAffirmations[currentIndex];
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !playlistId) return;

    const loadPlaylist = async () => {
      try {
        const playlistRef = doc(
          firebaseDb,
          'users',
          user.uid,
          'playlists',
          playlistId
        );
        const snapshot = await getDoc(playlistRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setPlaylist({
            id: snapshot.id,
            name: data.name ?? '',
            affirmationIds: data.affirmationIds ?? [],
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          });
        } else {
          toast({
            title: 'Playlist not found',
            description: 'This playlist does not exist or has been deleted.',
            variant: 'destructive',
          });
          router.push('/playlists');
        }
      } catch (error) {
        console.error('[playlist-view] Failed to load playlist', error);
        toast({
          title: 'Failed to load playlist',
          description: 'Unable to load the playlist. Please try again.',
          variant: 'destructive',
        });
        router.push('/playlists');
      } finally {
        setLoading(false);
      }
    };

    void loadPlaylist();
  }, [user, playlistId, router, toast]);

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
        setVoices(options);
        if (options.length > 0) {
          setSelectedVoice(profile?.voiceCloneId ?? options[0].id);
        }
      } catch (error) {
        console.error('[playlist-view] Failed to load voices', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    void fetchVoices();
  }, [profile?.voiceCloneId]);

  useEffect(() => {
    if (!currentAffirmation?.imageUrl) {
      setResolvedImageUrl(null);
      return;
    }

    const resolveUrl = async () => {
      const originalUrl = currentAffirmation.imageUrl!;
      if (originalUrl.startsWith('gs://')) {
        try {
          const path = originalUrl.replace(/^gs:\/\/[^/]+\//, '');
          const imageRef = ref(firebaseStorage, path);
          const downloadUrl = await getDownloadURL(imageRef);
          setResolvedImageUrl(downloadUrl);
        } catch (error) {
          console.error('[playlist-view] Failed to resolve image URL', error);
          setResolvedImageUrl(null);
        }
        return;
      }
      setResolvedImageUrl(originalUrl);
    };

    void resolveUrl();
  }, [currentAffirmation?.imageUrl]);

  const playNext = () => {
    if (currentIndex < playlistAffirmations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const playPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const playCurrent = async () => {
    if (!currentAffirmation || !selectedVoice) return;

    const affirmation = currentAffirmation;
    let audioUrl = affirmation?.audioUrls?.[selectedVoice];

    const usingVoiceClone = !!(
      profile?.voiceCloneId && selectedVoice === profile.voiceCloneId
    );
    const needsToGenerate = !audioUrl;

    // Block playback if using voice clone with no cached audio and insufficient credits
    if (usingVoiceClone && needsToGenerate) {
      if (!hasEnoughCredits(profile?.credits ?? 0, { useVoiceClone: true })) {
        toast({
          title: 'Insufficient aiams',
          description: `Voice clone playback costs ${VOICE_CLONE_COST} aiams. You currently have ${
            profile?.credits ?? 0
          }. Please top up your balance.`,
          variant: 'destructive',
        });
        router.push('/account?purchase=credits');
        return;
      }
      const remaining = Math.floor((profile?.credits ?? 0) / VOICE_CLONE_COST);
      if (remaining === 1) {
        toast({
          title: 'Running low on aiams',
          description: 'You have enough aiams for one more voice playback.',
        });
      }
    }

    if (needsToGenerate) {
      setIsFetchingAudio(true);
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: affirmation.affirmation,
            voiceId: selectedVoice,
          }),
        });

        if (!response.ok) {
          throw new Error('Unable to generate audio');
        }

        const audioBlob = await response.blob();
        const objectUrl = URL.createObjectURL(audioBlob);
        audioUrl = objectUrl;

        // If using personal voice and this voice isn't cached yet, upload & deduct credits
        if (usingVoiceClone) {
          try {
            const audioPath = `users/${user!.uid}/affirmations/${
              affirmation.id
            }/audio/${selectedVoice}.mp3`;
            const storageRef = ref(firebaseStorage, audioPath);
            await uploadBytes(
              storageRef,
              new Uint8Array(await audioBlob.arrayBuffer()),
              {
                contentType: 'audio/mpeg',
              }
            );
            const dl = await getDownloadURL(storageRef);
            await updateDoc(
              doc(
                firebaseDb,
                'users',
                user!.uid,
                'affirmations',
                affirmation.id
              ),
              {
                [`audioUrls.${selectedVoice}`]: dl,
                updatedAt: serverTimestamp(),
              }
            );

            // deduct credits once per generated audio
            const newCredits = Math.max(
              0,
              (profile?.credits ?? 0) - VOICE_CLONE_COST
            );
            await updateDoc(doc(firebaseDb, 'users', user!.uid), {
              credits: newCredits,
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.error(
              '[playlist-view] Failed to cache audio or update credits',
              e
            );
          }
        }
      } catch (error) {
        console.error('[playlist-view] Failed to generate audio', error);
        toast({
          title: 'Audio generation failed',
          description: 'Unable to generate audio for this affirmation.',
          variant: 'destructive',
        });
        return;
      } finally {
        setIsFetchingAudio(false);
      }
    }

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        resolve();
      };
      audio.onerror = (event) => {
        reject(event);
      };
      audio.play().catch(reject);
    });
  };

  const playSequentially = async () => {
    if (
      !currentAffirmation ||
      !selectedVoice ||
      playlistAffirmations.length === 0
    ) {
      return;
    }

    setIsPlaying(true);
    const stopAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };

    try {
      for (let i = currentIndex; i < playlistAffirmations.length; i++) {
        setCurrentIndex(i);
        await playCurrent();
        // Small delay between affirmations
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      toast({
        title: 'Playback finished',
        description: 'All affirmations in the playlist have been played.',
      });
    } catch (error) {
      console.error('[playlist-view] Playback failed', error);
      toast({
        title: 'Playback failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to play the playlist. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPlaying(false);
      stopAudio();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
    } else {
      void playSequentially();
    }
  };

  if (!user) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <div className='p-6 text-center'>
            <p className='text-muted-foreground'>Sign in to view playlists.</p>
          </div>
        </Card>
      </main>
    );
  }

  if (loading) {
    return (
      <main className='container mx-auto max-w-4xl px-6 py-12'>
        <Skeleton className='h-96 w-full rounded-lg' />
      </main>
    );
  }

  if (!playlist || playlistAffirmations.length === 0) {
    return (
      <main className='container mx-auto max-w-4xl px-6 py-12'>
        <Card>
          <div className='p-6 text-center'>
            <p className='text-muted-foreground'>
              {playlistAffirmations.length === 0
                ? 'This playlist is empty or contains affirmations that no longer exist.'
                : 'Playlist not found.'}
            </p>
            <Button
              variant='outline'
              className='mt-4'
              onClick={() => router.push('/playlists')}
            >
              Back to Playlists
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-4xl px-6 py-4 space-y-2'>
      <div className='flex items-center justify-between'>
        <div>
          <Button
            variant='ghost'
            onClick={() => router.push('/playlists')}
            className='mb-2 cursor-pointer'
          >
            <ChevronLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
          <h1 className='text-2xl font-semibold'>{playlist.name}</h1>
          <p className='text-muted-foreground'>
            {playlistAffirmations.length} affirmation
            {playlistAffirmations.length === 1 ? '' : 's'} • {currentIndex + 1}{' '}
            of {playlistAffirmations.length}
          </p>
        </div>
      </div>

      <Card className='relative p-0 overflow-hidden'>
        {resolvedImageUrl ? (
          <div className='relative h-[600px] w-full'>
            <Image
              src={resolvedImageUrl}
              alt='Affirmation visualization'
              fill
              unoptimized
              className='object-cover'
            />
            <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8'>
              <p className='text-xl font-semibold leading-relaxed text-white text-center'>
                {currentAffirmation.affirmation}
              </p>
            </div>
          </div>
        ) : (
          <div className='flex h-[600px] items-center justify-center bg-muted/30'>
            <div className='text-center space-y-4'>
              <p className='text-lg font-medium'>
                {currentAffirmation.affirmation}
              </p>
              <p className='text-sm text-muted-foreground'>
                No image available for this affirmation
              </p>
            </div>
          </div>
        )}

        {/* Top controls overlay */}
        <div className='absolute inset-x-0 top-4 flex items-center justify-center gap-4 z-10'>
          <div className='absolute left-4'>
            {/* Assuming DropdownMenu is from shadcn/ui or similar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  className='bg-background/80 backdrop-blur cursor-pointer'
                  disabled={loadingVoices || isPlaying}
                >
                  <Mic className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start' className='w-56'>
                {voices.length === 0 ? (
                  <DropdownMenuItem disabled>
                    {loadingVoices ? 'Loading voices…' : 'No voices available'}
                  </DropdownMenuItem>
                ) : (
                  voices.map((voice) => (
                    <DropdownMenuItem
                      key={voice.id}
                      onSelect={() => setSelectedVoice(voice.id)}
                      className='flex items-start justify-between gap-3'
                      disabled={isPlaying}
                    >
                      <div className='flex flex-col text-left'>
                        <span>{voice.name}</span>
                        {voice.description && (
                          <span className='text-xs text-muted-foreground'>
                            {voice.description}
                          </span>
                        )}
                      </div>
                      {selectedVoice === voice.id && (
                        <Check className='h-4 w-4' />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant='outline'
            size='icon'
            onClick={playPrevious}
            disabled={currentIndex === 0 || isPlaying || isFetchingAudio}
            className='bg-background/80 backdrop-blur cursor-pointer'
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            variant='default'
            size='lg'
            onClick={handlePlayPause}
            disabled={loadingVoices || !selectedVoice || isFetchingAudio}
            className='bg-background/80 backdrop-blur'
          >
            {isPlaying ? (
              <>
                <Square className='mr-2 h-5 w-4' />
                Stop
              </>
            ) : (
              <>
                {isFetchingAudio ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Preparing…
                  </>
                ) : (
                  <>
                    <span className='sr-only'>Play</span>
                    <Play className='h-4 w-4 text-gray-500 cursor-pointer' />
                    <span className='ml-2 text-gray-500 cursor-pointer'>
                      Play All
                    </span>
                  </>
                )}
              </>
            )}
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={playNext}
            disabled={
              currentIndex === playlistAffirmations.length - 1 ||
              isPlaying ||
              isFetchingAudio
            }
            className='bg-background/80 backdrop-blur cursor-pointer'
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </Card>

      {/* Remove bottom voice select per request; voice selection is now via the mic icon in the overlay */}
    </main>
  );
}
