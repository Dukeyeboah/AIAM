'use client';

import { useMemo, useState, useEffect } from 'react';
import { HeartPulse, Play, FolderPlus } from 'lucide-react';
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
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<
    Array<{ id: string; name: string; description: string }>
  >([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const total = useMemo(() => affirmations.length, [affirmations.length]);

  const playSequentially = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      const cleanup = () => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = (event) => {
        cleanup();
        reject(event);
      };
      audio.play().catch((error) => {
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

    setIsPlayingAll(true);
    const voiceId = selectedVoiceId;
    const isClonedVoice = voiceId === profile?.voiceCloneId;
    try {
      for (const item of affirmations) {
        let audioUrl = item.audioUrls?.[voiceId];
        if (!audioUrl) {
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

        await playSequentially(audioUrl);

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
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold'>Saved affirmations</h1>
          <p className='text-muted-foreground'>
            Every affirmation you've favorited lives here. Filter by category,
            revisit images, and keep your inspiration close.
          </p>
        </div>
        <div className='flex gap-3 items-center'>
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
        </div>
      </div>

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
