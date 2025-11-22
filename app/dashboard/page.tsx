'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  FolderPlus,
  Play,
  Pause,
  Square,
  Music,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';
import { UserAffirmationCard } from '@/components/user-affirmation-card';
import { firebaseDb, firebaseStorage } from '@/lib/firebase/client';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export default function DashboardPage() {
  const { user, profile, authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    'all'
  );
  const { affirmations, categories, loading } = useUserAffirmations({
    categoryId: selectedCategory === 'all' ? null : selectedCategory,
  });
  const { toast } = useToast();
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; description: string }>
  >([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [playAllDialogOpen, setPlayAllDialogOpen] = useState(false);
  const [hasSeenPlayAllDialog, setHasSeenPlayAllDialog] = useState(false);
  const [withMusic, setWithMusic] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playAllAbortRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);

  const greeting = useMemo(() => {
    if (!profile?.displayName) return 'Your dashboard';
    const firstName = profile.displayName.trim().split(/\s+/)[0];
    return `${firstName}'s dashboard`;
  }, [profile?.displayName]);

  // Load voices and set default
  useEffect(() => {
    const loadVoices = async () => {
      setLoadingVoices(true);
      try {
        const response = await fetch('/api/voices');
        if (!response.ok) {
          throw new Error('Unable to load voices right now.');
        }
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
        // Set default based on useMyVoiceByDefault preference
        if (!selectedVoiceId) {
          if (profile?.useMyVoiceByDefault && profile?.voiceCloneId) {
            setSelectedVoiceId(profile.voiceCloneId);
          } else {
            setSelectedVoiceId(
              profile?.voiceCloneId ?? options[0]?.id ?? 'EXAVITQu4vr4xnSDxMaL'
            );
          }
        }
      } catch (error) {
        console.error('[dashboard] Failed to load voices', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    if (user) {
      void loadVoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.voiceCloneId, profile?.voiceCloneName]);

  const playSequentially = (url: string, index: number) =>
    new Promise<void>((resolve, reject) => {
      // Check if paused
      if (isPaused) {
        // Wait until resumed
        const checkPause = setInterval(() => {
          if (!isPaused) {
            clearInterval(checkPause);
            // Resume playback
            if (currentAudioRef.current) {
              currentAudioRef.current.play().catch((error) => {
                cleanup();
                reject(error);
              });
            }
          }
        }, 100);
        return;
      }

      // Check if aborted
      if (playAllAbortRef.current?.signal.aborted) {
        resolve();
        return;
      }

      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setCurrentAudioIndex(index);

      const cleanup = () => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      };

      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = (event) => {
        cleanup();
        reject(event);
      };

      // Handle pause during playback
      const handlePause = () => {
        if (isPaused) {
          audio.pause();
        }
      };

      // Check pause state periodically
      const pauseCheckInterval = setInterval(() => {
        if (isPaused && !audio.paused) {
          audio.pause();
        } else if (
          !isPaused &&
          audio.paused &&
          currentAudioRef.current === audio
        ) {
          audio.play().catch((error) => {
            cleanup();
            reject(error);
          });
        }
        if (playAllAbortRef.current?.signal.aborted) {
          clearInterval(pauseCheckInterval);
          cleanup();
          resolve();
        }
      }, 100);

      audio
        .play()
        .then(() => {
          // Clear interval when playing
          clearInterval(pauseCheckInterval);
        })
        .catch((error) => {
          clearInterval(pauseCheckInterval);
          cleanup();
          reject(error);
        });
    });

  const stopPlayAll = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (playAllAbortRef.current) {
      playAllAbortRef.current.abort();
      playAllAbortRef.current = null;
    }
    setIsPlayingAll(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentAudioIndex(0);
  };

  const pausePlayAll = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
  };

  const resumePlayAll = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.play().catch((error) => {
        console.error('[dashboard] Failed to resume playback', error);
      });
    }
  };

  // Check if first time playing all
  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenPlayAllDialog');
    setHasSeenPlayAllDialog(hasSeen === 'true');
  }, []);

  const playAll = async () => {
    if (!user || affirmations.length === 0) {
      return;
    }

    if (!selectedVoiceId) {
      toast({
        title: 'Select a voice',
        description: 'Please choose a voice to play all affirmations.',
        variant: 'destructive',
      });
      return;
    }

    // Show dialog on first time
    if (!hasSeenPlayAllDialog) {
      setPlayAllDialogOpen(true);
      return;
    }

    await startPlayAll();
  };

  const startPlayAll = async () => {
    if (!user || affirmations.length === 0) {
      return;
    }

    setIsPlayingAll(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentAudioIndex(0);
    playAllAbortRef.current = new AbortController();
    const voiceId = selectedVoiceId;
    const isClonedVoice = voiceId === profile?.voiceCloneId;

    // Start background music if enabled
    if (withMusic) {
      // Trigger music player to play
      window.dispatchEvent(new CustomEvent('start-background-music'));
    }

    try {
      for (let i = 0; i < affirmations.length; i++) {
        const item = affirmations[i];

        // Check if aborted
        if (playAllAbortRef.current?.signal.aborted) {
          break;
        }

        // Check if paused - wait until resumed (using ref for current state)
        while (
          isPausedRef.current &&
          !playAllAbortRef.current?.signal.aborted
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Check if aborted after pause check
        if (playAllAbortRef.current?.signal.aborted) {
          break;
        }

        let audioUrl = item.audioUrls?.[voiceId];
        if (!audioUrl) {
          // Check if paused before fetching (using ref for current state)
          while (
            isPausedRef.current &&
            !playAllAbortRef.current?.signal.aborted
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (playAllAbortRef.current?.signal.aborted) {
            break;
          }

          const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: item.affirmation,
              voiceId,
            }),
          });

          if (!response.ok) {
            const detailText = await response.text();
            try {
              const detailJson = JSON.parse(detailText);
              const status = detailJson?.detail?.detail?.status;
              if (status === 'detected_unusual_activity') {
                throw new Error(
                  'ElevenLabs temporarily disabled free-tier synthesis due to unusual activity. Upgrade your ElevenLabs plan to continue using Play all.'
                );
              }
              throw new Error(
                detailJson?.error ??
                  'Unable to generate audio for one of your affirmations.'
              );
            } catch (parseError) {
              if (
                parseError instanceof Error &&
                parseError.message.includes('ElevenLabs temporarily')
              ) {
                throw parseError;
              }
              throw new Error(
                `Unable to generate audio for one of your affirmations. ${detailText}`
              );
            }
          }

          const audioBlob = await response.blob();
          const storageRef = ref(
            firebaseStorage,
            `users/${user.uid}/affirmations/${item.id}/audio/${voiceId}.mp3`
          );
          await uploadBytes(storageRef, audioBlob);
          audioUrl = await getDownloadURL(storageRef);
          await updateDoc(
            doc(firebaseDb, 'users', user.uid, 'affirmations', item.id),
            {
              [`audioUrls.${voiceId}`]: audioUrl,
              updatedAt: serverTimestamp(),
            }
          );
        }

        await playSequentially(audioUrl, i);

        // Deduct credits if using cloned voice (only once per affirmation if not cached)
        if (isClonedVoice && !item.audioUrls?.[voiceId] && profile) {
          const { hasEnoughCredits } = await import('@/lib/credit-utils');
          if (hasEnoughCredits(profile.credits, { useVoiceClone: true })) {
            const { VOICE_CLONE_COST } = await import('@/lib/credit-utils');
            const newCredits = profile.credits - VOICE_CLONE_COST;
            const userDocRef = doc(firebaseDb, 'users', user.uid);
            await updateDoc(userDocRef, {
              credits: newCredits,
              updatedAt: serverTimestamp(),
            });
            // Refresh profile to update credits in UI
            await refreshProfile();
          }
        }
      }
      // Stop background music if enabled
      if (withMusic) {
        window.dispatchEvent(new CustomEvent('stop-background-music'));
      }

      toast({
        title: 'Playback finished',
        description: 'All affirmations in this view have been played.',
      });
    } catch (error) {
      console.error('[dashboard] Play all failed', error);
      toast({
        title: 'Playback failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to play the full set. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPlayingAll(false);
      setIsPaused(false);
      isPausedRef.current = false;
      setCurrentAudioIndex(0);
      currentAudioRef.current = null;
      playAllAbortRef.current = null;
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
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
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Sign in to review your affirmations, saved images, and playlists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-6xl px-6 py-0 pb-8 space-y-8'>
      <div className='flex flex-col gap-4'>
        <div>
          <h1 className='text-3xl font-semibold'>{greeting}</h1>
          <p className='text-muted-foreground'>
            Review your affirmations—filter by category, spot favorites, and
            prep playlists.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <Select
              value={selectedVoiceId}
              onValueChange={setSelectedVoiceId}
              disabled={isPlayingAll || loadingVoices}
            >
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Select voice' />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isPlayingAll ? (
              <Button
                variant='default'
                onClick={playAll}
                disabled={affirmations.length === 0 || !selectedVoiceId}
                className='flex items-center gap-2'
              >
                <Play className='h-4 w-4' />
                Play all
              </Button>
            ) : (
              <div className='flex items-center gap-2'>
                {isPaused ? (
                  <Button
                    variant='default'
                    onClick={resumePlayAll}
                    className='flex items-center gap-2'
                  >
                    <Play className='h-4 w-4' />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant='default'
                    onClick={pausePlayAll}
                    className='flex items-center gap-2'
                  >
                    <Pause className='h-4 w-4' />
                    Pause
                  </Button>
                )}
                <Button
                  variant='secondary'
                  onClick={stopPlayAll}
                  className='flex items-center gap-2'
                >
                  <Square className='h-4 w-4' />
                  Stop
                </Button>
              </div>
            )}
          </div>
          <div className='flex items-center gap-2 px-2'>
            <Switch
              id='with-music'
              checked={withMusic}
              onCheckedChange={setWithMusic}
              disabled={isPlayingAll}
              title={
                isPlayingAll
                  ? 'Use the music player in the header to add background music'
                  : 'Play background music during playback'
              }
            />
            <Label
              htmlFor='with-music'
              className='flex items-center gap-1 cursor-pointer'
              title={
                isPlayingAll
                  ? 'Use the music player in the header to add background music'
                  : 'Play background music during playback'
              }
            >
              <Music className='h-4 w-4' />
              <span className='text-sm'>With music</span>
            </Label>
          </div>
          <Button
            variant='secondary'
            onClick={() => router.push('/playlists')}
            className='flex items-center gap-2 cursor-pointer'
          >
            <FolderPlus className='h-4 w-4' />
            Playlists
          </Button>
          <Button onClick={() => setSelectedCategory('all')} variant='outline'>
            Clear filters
          </Button>
        </div>
      </div>

      <Dialog open={playAllDialogOpen} onOpenChange={setPlayAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>First time playing all affirmations?</DialogTitle>
            <DialogDescription>
              The first time you play all affirmations, there may be brief
              pauses between each one as we generate and cache the audio files.
              This is normal and only happens once.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <p className='text-sm text-muted-foreground'>
              After the first playback, all audio files will be cached, and
              subsequent playbacks will flow smoothly without pauses.
            </p>
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='dont-show-again'
                className='rounded border-gray-300'
                onChange={(e) => {
                  if (e.target.checked) {
                    localStorage.setItem('hasSeenPlayAllDialog', 'true');
                    setHasSeenPlayAllDialog(true);
                  }
                }}
              />
              <Label
                htmlFor='dont-show-again'
                className='text-sm cursor-pointer'
              >
                Don't show this again
              </Label>
            </div>
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={() => setPlayAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPlayAllDialogOpen(false);
                void startPlayAll();
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>Affirmations</CardTitle>
            <CardDescription>
              {affirmations.length > 0
                ? `Showing ${affirmations.length} affirmation${
                    affirmations.length === 1 ? '' : 's'
                  }.`
                : 'Start generating to see your affirmations here.'}
            </CardDescription>
          </div>
          <Select
            value={selectedCategory}
            onValueChange={(value) =>
              setSelectedCategory(value as string | 'all')
            }
          >
            <SelectTrigger className='w-56'>
              <SelectValue placeholder='Filter by category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <PlusCircle className='h-10 w-10 text-muted-foreground' />
                <div>
                  <h3 className='text-lg font-medium'>No affirmations yet</h3>
                  <p className='text-sm text-muted-foreground'>
                    Generate an affirmation from the home page to start building
                    your collection.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className='grid gap-6 grid-cols-1 md:grid-cols-2'>
              {affirmations.map((item) => (
                <UserAffirmationCard key={item.id} affirmation={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
