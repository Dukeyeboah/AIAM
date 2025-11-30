'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import {
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Check,
  Download,
  MoreVertical,
  Music,
} from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, listAll } from 'firebase/storage';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const [downloading, setDownloading] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [withMusic, setWithMusic] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
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

        // Add cloned voice option if available
        if (profile?.voiceCloneId) {
          options.unshift({
            id: profile.voiceCloneId,
            name: profile.voiceCloneName ?? 'Your Voice',
            description: 'Your personal cloned voice',
          });
        }

        setVoices(options);
        if (options.length > 0) {
          // Set default voice: prefer cloned voice if useMyVoiceByDefault is enabled, otherwise use cloned voice if available, else first AI voice
          if (profile?.useMyVoiceByDefault && profile?.voiceCloneId) {
            setSelectedVoice(profile.voiceCloneId);
          } else if (profile?.voiceCloneId) {
            setSelectedVoice(profile.voiceCloneId);
          } else {
            setSelectedVoice(options[0].id);
          }
        }
      } catch (error) {
        console.error('[playlist-view] Failed to load voices', error);
      } finally {
        setLoadingVoices(false);
      }
    };

    void fetchVoices();
  }, [
    profile?.voiceCloneId,
    profile?.voiceCloneName,
    profile?.useMyVoiceByDefault,
  ]);

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

  const playCurrent = async (affirmationIndex?: number) => {
    // Use provided index or current index
    const index =
      affirmationIndex !== undefined ? affirmationIndex : currentIndex;
    const affirmation = playlistAffirmations[index];

    if (!affirmation || !selectedVoice) return;

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

    // Start background music if enabled
    if (withMusic) {
      window.dispatchEvent(new CustomEvent('start-background-music'));
    }

    const stopAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      // Stop background music if it was playing
      if (withMusic) {
        window.dispatchEvent(new CustomEvent('stop-background-music'));
        // Mix and cache audio with music after playback completes
        void mixAndCachePlaylistAudioWithMusic();
      }
    };

    try {
      // Play affirmations sequentially
      for (let i = currentIndex; i < playlistAffirmations.length; i++) {
        setCurrentIndex(i);
        await playCurrent(i);
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

  // Check for existing mixed audio on mount and when voice changes
  useEffect(() => {
    const checkMixedAudio = async () => {
      if (!user || !playlist || !selectedVoice) {
        setMixedAudioUrl(null);
        return;
      }

      try {
        const mixedAudioRef = ref(
          firebaseStorage,
          `users/${user.uid}/playlists/${playlist.id}/audio/${selectedVoice}_with_music.mp3`
        );
        const url = await getDownloadURL(mixedAudioRef).catch(() => null);
        setMixedAudioUrl(url);
      } catch (error) {
        setMixedAudioUrl(null);
      }
    };

    void checkMixedAudio();
  }, [user, playlist, selectedVoice]);

  // Mix playlist audio with background music and cache it
  const mixAndCachePlaylistAudioWithMusic = async () => {
    if (!user || !playlist || !selectedVoice) return;

    try {
      // Get all audio URLs for affirmations
      const audioUrls: string[] = [];
      for (const aff of playlistAffirmations) {
        const audioUrl = aff.audioUrls?.[selectedVoice];
        if (!audioUrl) {
          throw new Error('Not all affirmations have cached audio');
        }
        audioUrls.push(audioUrl);
      }

      // Get music URL from music player (we'll need to get it from storage)
      const musicRef = ref(firebaseStorage, 'music');
      const { listAll } = await import('firebase/storage');
      const files = await listAll(musicRef);
      if (files.items.length === 0) {
        throw new Error('No music available');
      }
      const musicUrl = await getDownloadURL(files.items[0]);

      // Initialize Web Audio API
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Load and decode all affirmation audio files
      const affirmationBuffers = await Promise.all(
        audioUrls.map(async (url) => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          return await audioContext.decodeAudioData(arrayBuffer);
        })
      );

      // Load and decode music file
      const musicResponse = await fetch(musicUrl);
      const musicArrayBuffer = await musicResponse.arrayBuffer();
      const musicBuffer = await audioContext.decodeAudioData(musicArrayBuffer);

      // Calculate total duration (sum of all affirmation durations + gaps)
      const gapDuration = 0.5;
      const totalDuration =
        affirmationBuffers.reduce((sum, buf) => sum + buf.duration, 0) +
        gapDuration * (affirmationBuffers.length - 1);

      // Create output buffer
      const sampleRate = audioContext.sampleRate;
      const outputBuffer = audioContext.createBuffer(
        2, // Stereo
        Math.ceil(totalDuration * sampleRate),
        sampleRate
      );

      // Mix all affirmations sequentially with gaps
      let currentOffset = 0;
      for (let i = 0; i < affirmationBuffers.length; i++) {
        const affBuffer = affirmationBuffers[i];
        const affData = affBuffer.getChannelData(0);
        const affData1 =
          affBuffer.numberOfChannels > 1
            ? affBuffer.getChannelData(1)
            : affData;
        const outputData0 = outputBuffer.getChannelData(0);
        const outputData1 = outputBuffer.getChannelData(1);

        // Copy affirmation audio to output buffer
        for (let j = 0; j < affData.length; j++) {
          if (currentOffset + j < outputData0.length) {
            outputData0[currentOffset + j] += affData[j];
            outputData1[currentOffset + j] += affData1[j];
          }
        }
        currentOffset += affData.length;

        // Add gap between affirmations
        const gapSamples = Math.floor(gapDuration * sampleRate);
        currentOffset += gapSamples;
      }

      // Mix music at 20% volume, looping to match total duration
      const musicData = musicBuffer.getChannelData(0);
      const musicData1 =
        musicBuffer.numberOfChannels > 1
          ? musicBuffer.getChannelData(1)
          : musicData;
      const outputData0 = outputBuffer.getChannelData(0);
      const outputData1 = outputBuffer.getChannelData(1);
      const musicGain = 0.2; // 20% volume

      for (let i = 0; i < outputBuffer.length; i++) {
        const musicIndex = i % musicData.length;
        outputData0[i] += musicData[musicIndex] * musicGain;
        outputData1[i] += musicData1[musicIndex] * musicGain;
      }

      // Convert buffer to WAV blob
      const wav = audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });

      // Upload to Firebase Storage
      const audioPath = `users/${user.uid}/playlists/${playlist.id}/audio/${selectedVoice}_with_music.mp3`;
      const storageRef = ref(firebaseStorage, audioPath);
      await uploadBytes(storageRef, blob, { contentType: 'audio/mpeg' });
      const downloadUrl = await getDownloadURL(storageRef);

      setMixedAudioUrl(downloadUrl);

      toast({
        title: 'Mixed audio saved',
        description:
          'Your playlist audio with music has been saved and is ready to download.',
      });
    } catch (error) {
      console.error('[playlist-view] Failed to mix audio with music:', error);
      throw error;
    }
  };

  // Helper function to convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(channel)[i])
        );
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return arrayBuffer;
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

  // Check if all affirmations have cached audio for selected voice
  const checkAllAudioReady = (): boolean => {
    if (!selectedVoice || playlistAffirmations.length === 0) return false;
    return playlistAffirmations.every((aff) => {
      const audioUrls = aff.audioUrls || {};
      return !!audioUrls[selectedVoice];
    });
  };

  const handleDownloadClick = (withMusicDownload: boolean = false) => {
    if (!selectedVoice) {
      toast({
        title: 'Select a voice',
        description: 'Please select a voice before downloading.',
        variant: 'destructive',
      });
      return;
    }

    // If downloading with music, check if mixed audio exists
    if (withMusicDownload) {
      if (mixedAudioUrl) {
        // Download the cached mixed audio
        const a = document.createElement('a');
        a.href = mixedAudioUrl;
        a.download = `${playlist?.name.replace(
          /[^a-z0-9]/gi,
          '_'
        )}_${selectedVoice}_with_music.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({
          title: 'Download complete',
          description: 'Your playlist audio with music has been downloaded.',
        });
        return;
      } else {
        toast({
          title: 'No mixed audio available',
          description:
            'Please play all affirmations with music first to generate the mixed audio.',
          variant: 'destructive',
        });
        return;
      }
    }

    const isReady = checkAllAudioReady();
    if (!isReady) {
      setDownloadDialogOpen(true);
      return;
    }

    void handleDownload();
  };

  const handleDownload = async () => {
    if (!user || !playlist || !selectedVoice) return;

    setDownloading(true);

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
          playlistId: playlist.id,
          voiceId: selectedVoice,
          withMusic: false,
          withImages: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'Not all affirmations have cached audio') {
          setDownloadDialogOpen(true);
          return;
        }
        throw new Error(data.error || 'Failed to download playlist');
      }

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type');
      const isVideo = contentType?.includes('video');
      const extension = isVideo ? '.mp4' : '.mp3';
      let fileName = `${playlist.name.replace(
        /[^a-z0-9]/gi,
        '_'
      )}_${selectedVoice}${extension}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/i);
        if (match) {
          fileName = decodeURIComponent(match[1]);
        }
      }

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
      console.error('[playlist-view] Download failed', error);
      toast({
        title: 'Download failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to download the playlist. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
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
        <div className='flex-1'>
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
        <div className='flex items-center gap-2'>
          <Switch
            id='with-music-playlist'
            checked={withMusic}
            onCheckedChange={setWithMusic}
            disabled={isPlaying}
            title={
              isPlaying
                ? 'Use the music player in the header to add background music'
                : 'Play background music during playback'
            }
          />
          <Label
            htmlFor='with-music-playlist'
            className='flex items-center gap-1 cursor-pointer'
            title={
              isPlaying
                ? 'Use the music player in the header to add background music'
                : 'Play background music during playback'
            }
          >
            <Music className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm'>With music</span>
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreVertical className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => handleDownloadClick(false)}
                disabled={downloading || !selectedVoice}
              >
                <Download className='mr-2 h-4 w-4' />
                {downloading ? 'Downloading...' : 'Download playlist audio'}
              </DropdownMenuItem>
              {mixedAudioUrl && (
                <DropdownMenuItem
                  onClick={() => handleDownloadClick(true)}
                  disabled={downloading || !selectedVoice}
                >
                  <Music className='mr-2 h-4 w-4' />
                  {downloading ? 'Downloading...' : 'Download with music'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className='relative p-0 overflow-hidden'>
        {resolvedImageUrl ? (
          <div className='relative h-[600px] w-full'>
            <NextImage
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

      {/* Download Dialog - shows when audio not ready */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-md sm:w-full'>
          <DialogHeader>
            <DialogTitle>Play All First</DialogTitle>
            <DialogDescription>
              To download the playlist audio, you need to play all affirmations
              in the playlist first. This ensures all audio files are cached and
              ready for download.
            </DialogDescription>
          </DialogHeader>
          <div className='flex justify-end gap-3 pt-4'>
            <Button
              variant='outline'
              onClick={() => setDownloadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDownloadDialogOpen(false);
                void playSequentially();
              }}
            >
              Play All Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
