'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  HeartPulse,
  Play,
  FolderPlus,
  Pause,
  Square,
  Music,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
import { Skeleton } from '@/components/ui/skeleton';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';
import { useAuth } from '@/providers/auth-provider';
import { UserAffirmationCard } from '@/components/user-affirmation-card';
import { useToast } from '@/hooks/use-toast';
import { firebaseDb, firebaseStorage } from '@/lib/firebase/client';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SavedPage() {
  const { user, profile, authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    'all'
  );
  const { affirmations, categories, loading } = useUserAffirmations({
    favoritesOnly: true,
    categoryId: selectedCategory === 'all' ? null : selectedCategory,
  });
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

  const total = useMemo(() => affirmations.length, [affirmations.length]);

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

      // Check pause state periodically
      const pauseCheckInterval = setInterval(() => {
        if (isPaused && !audio.paused) {
          audio.pause();
        } else if (
          !isPaused &&
          audio.paused &&
          currentAudioRef.current === audio
        ) {
          audio.play().catch((error: unknown) => {
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
        .catch((error: unknown) => {
          clearInterval(pauseCheckInterval);
          cleanup();
          reject(error);
        });
    });

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
        // Set default: only use cloned voice if useMyVoiceByDefault is enabled AND voice exists
        if (!selectedVoiceId) {
          if (profile?.useMyVoiceByDefault && profile?.voiceCloneId) {
            // Only default to cloned voice if user has enabled "use my voice by default"
            setSelectedVoiceId(profile.voiceCloneId);
          } else if (options.length > 0) {
            setSelectedVoiceId(options[0].id);
          } else {
            setSelectedVoiceId('EXAVITQu4vr4xnSDxMaL');
          }
        }
      } catch (error) {
        console.error('[saved] Failed to load voices', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    if (user) {
      void loadVoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.voiceCloneId, profile?.voiceCloneName]);

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
      currentAudioRef.current.play().catch((error: unknown) => {
        console.error('[saved] Failed to resume playback', error);
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
      console.error('[saved] Play all failed', error);
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

  if (authLoading) {
    return (
      <main className='container mx-auto max-w-4xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Saved affirmations</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className='container mx-auto max-w-4xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Saved affirmations</CardTitle>
            <CardDescription>
              Sign in to revisit the affirmations you've marked as favorites.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-5xl px-6 py-12 space-y-8'>
      <div className='flex flex-col gap-4'>
        <div>
          <h1 className='text-3xl font-semibold'>Saved affirmations</h1>
          <p className='text-muted-foreground'>
            Every affirmation you've favorited lives here. Filter by category,
            revisit images, and keep your inspiration close.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Select
            value={selectedCategory}
            onValueChange={(value) =>
              setSelectedCategory(value as string | 'all')
            }
          >
            <SelectTrigger className='w-48'>
              <SelectValue placeholder='Filter category' />
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
              id='with-music-saved'
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
              htmlFor='with-music-saved'
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
                id='dont-show-again-saved'
                className='rounded border-gray-300'
                onChange={(e) => {
                  if (e.target.checked) {
                    localStorage.setItem('hasSeenPlayAllDialog', 'true');
                    setHasSeenPlayAllDialog(true);
                  }
                }}
              />
              <Label
                htmlFor='dont-show-again-saved'
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
            <CardTitle>Favorites</CardTitle>
            <CardDescription>
              {total > 0
                ? `You've saved ${total} affirmation${total === 1 ? '' : 's'}.`
                : 'Tap the heart icon inside the generator to save affirmations here.'}
            </CardDescription>
          </div>
          <div className='flex gap-3 items-center'>
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
              <Button
                variant='default'
                onClick={playAll}
                disabled={
                  isPlayingAll || affirmations.length === 0 || !selectedVoiceId
                }
                className='flex items-center gap-2'
              >
                <Play className='h-4 w-4' />
                {isPlayingAll ? 'Playing…' : 'Play all'}
              </Button>
            </div>
            <Button
              variant='outline'
              onClick={() => setSelectedCategory('all')}
            >
              Clear filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className='h-64 rounded-2xl' />
              ))}
            </div>
          ) : affirmations.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-4 py-16 text-center'>
              <HeartPulse className='h-10 w-10 text-muted-foreground' />
              <div>
                <h3 className='text-lg font-medium'>
                  No saved affirmations yet
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Mark affirmations as favorites to build your collection.
                </p>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              {affirmations.map((item) => (
                <UserAffirmationCard
                  key={item.id}
                  affirmation={item}
                  showFavoriteBadge={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
