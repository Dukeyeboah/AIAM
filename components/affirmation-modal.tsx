'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Category } from './category-grid';
import {
  RefreshCw,
  Volume2,
  Bookmark,
  BookmarkCheck,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mic,
  Check,
  Square,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/providers/auth-provider';
import { firebaseDb } from '@/lib/firebase/client';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

interface VoiceOption {
  id: string;
  name: string;
  previewUrl?: string;
}

interface AffirmationModalProps {
  category: Category | null;
  categories: Category[];
  currentIndex: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (direction: number) => void;
}

export function AffirmationModal({
  category,
  categories,
  currentIndex,
  open,
  onOpenChange,
  onNavigate,
}: AffirmationModalProps) {
  const [affirmation, setAffirmation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<
    'image' | 'voice' | null
  >(null);
  const [affirmationDocId, setAffirmationDocId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const userAffirmationsCollection = useMemo(() => {
    if (!user) return null;
    return collection(firebaseDb, 'users', user.uid, 'affirmations');
  }, [user]);

  const resetAffirmationState = () => {
    setAffirmation('');
    setGeneratedImage(null);
    setAffirmationDocId(null);
    setIsFavorite(false);
  };

  const generateAffirmation = async () => {
    if (!category) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description:
          'You need an AiAm account to generate and save affirmations.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setAffirmationDocId(null);
    setIsFavorite(false);

    try {
      const response = await fetch('/api/generate-affirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: category.id,
          category: category.title,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to generate affirmation right now.');
      }

      const data = await response.json();
      if (!data.affirmation) {
        throw new Error('Affirmation generation returned no result.');
      }
      setAffirmation(data.affirmation);

      if (userAffirmationsCollection) {
        try {
          const docRef = await addDoc(userAffirmationsCollection, {
            affirmation: data.affirmation,
            categoryId: category.id,
            categoryTitle: category.title,
            imageUrl: null,
            favorite: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setAffirmationDocId(docRef.id);
        } catch (saveError) {
          console.error(
            '[AffirmationModal] Failed to save affirmation:',
            saveError
          );
          toast({
            title: 'Saved locally only',
            description:
              'We generated your affirmation but could not store it yet.',
          });
        }
      }
    } catch (error) {
      console.error('[AffirmationModal] Error generating affirmation:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to generate affirmation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!affirmation || !category) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description:
          'Create an account or log in to generate images with your affirmations.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affirmation,
          category: category.title,
          categoryId: category.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const detail =
          data?.error ??
          data?.detail ??
          (typeof data === 'string' ? data : null) ??
          'Unable to start image generation.';
        throw new Error(detail);
      }

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        if (user && affirmationDocId) {
          try {
            await updateDoc(
              doc(
                firebaseDb,
                'users',
                user.uid,
                'affirmations',
                affirmationDocId
              ),
              {
                imageUrl: data.imageUrl,
                updatedAt: serverTimestamp(),
              }
            );
          } catch (updateError) {
            console.error(
              '[AffirmationModal] Failed to attach image to affirmation:',
              updateError
            );
          }
        }
        return;
      }

      throw new Error('Image generation response was incomplete.');
    } catch (error) {
      console.error('[AffirmationModal] Error generating image:', error);
      toast({
        title: 'Image generation failed',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong while creating the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speakAffirmation = async () => {
    if (!affirmation) return;

    if (audioRef.current && !audioRef.current.paused) {
      stopAudioPlayback();
      return;
    }

    if (!selectedVoice) {
      toast({
        title: 'Select a voice',
        description: 'Please choose a voice to play the affirmation.',
        variant: 'default',
      });
      return;
    }

    try {
      setIsSpeaking(true);
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: affirmation,
          voiceId: selectedVoice,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to create audio using the selected voice.');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      stopAudioPlayback();
      audioRef.current.src = audioUrl;
      audioUrlRef.current = audioUrl;

      audioRef.current.onended = () => {
        stopAudioPlayback();
      };
      audioRef.current.onerror = () => {
        stopAudioPlayback();
      };

      await audioRef.current.play();
    } catch (error) {
      console.error('[AffirmationModal] Error with text-to-speech:', error);
      toast({
        title: 'Playback failed',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong while playing the affirmation.',
        variant: 'destructive',
      });
      stopAudioPlayback();
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Log in to save affirmations to your favorites.',
      });
      return;
    }

    if (!affirmationDocId) {
      toast({
        title: 'Affirmation not ready',
        description:
          'Generate an affirmation first before adding it to your favorites.',
      });
      return;
    }

    const nextFavorite = !isFavorite;
    setIsSavingFavorite(true);

    try {
      await updateDoc(
        doc(firebaseDb, 'users', user.uid, 'affirmations', affirmationDocId),
        {
          favorite: nextFavorite,
          updatedAt: serverTimestamp(),
        }
      );
      setIsFavorite(nextFavorite);
      toast({
        title: nextFavorite ? 'Favorited!' : 'Removed from favorites',
        description: nextFavorite
          ? 'Affirmation saved to your favorites.'
          : 'Affirmation removed from favorites.',
      });
    } catch (error) {
      console.error('[AffirmationModal] Failed to toggle favorite:', error);
      toast({
        title: 'Unable to update favorite',
        description:
          'We could not update this affirmation right now. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingFavorite(false);
    }
  };

  useEffect(() => {
    if (!open) {
      stopAudioPlayback();
      setGeneratedImage(null);
      resetAffirmationState();
      return;
    }

    if (category) {
      generateAffirmation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id]);

  useEffect(() => {
    if (!open || voices.length > 0) {
      return;
    }

    let isActive = true;
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const response = await fetch('/api/voices');
        if (!response.ok) {
          throw new Error('Unable to load voices right now.');
        }
        const data = await response.json();
        const voiceOptions: VoiceOption[] =
          data.voices?.map((voice: any) => ({
            id: voice.voice_id ?? voice.id,
            name: voice.name,
            previewUrl: voice.preview_url ?? voice.preview_url,
          })) ?? [];

        if (isActive) {
          setVoices(voiceOptions);
          if (!selectedVoice && voiceOptions.length > 0) {
            setSelectedVoice(voiceOptions[0].id);
          }
        }
      } catch (error) {
        console.error('[AffirmationModal] Error fetching voices:', error);
        toast({
          title: 'Unable to load voices',
          description:
            'We could not fetch voice options from ElevenLabs. Check your API key and try again.',
        });
      } finally {
        if (isActive) {
          setIsLoadingVoices(false);
        }
      }
    };

    fetchVoices();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!category) return null;

  const Icon = category.icon;
  const hasMultipleCategories = categories.length > 1;
  const featureDescriptions: Record<
    'image' | 'voice',
    { title: string; description: string }
  > = {
    image: {
      title: 'Bring your own image',
      description:
        'To generate affirmations with your personal imagery, you’ll need an account and at least one uploaded photo.',
    },
    voice: {
      title: 'Use your own voice',
      description:
        'Upload a short voice sample after creating an account to hear affirmations read in your voice.',
    },
  };

  const handleUnavailableFeature = (feature: 'image' | 'voice') => {
    setPendingFeature(feature);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
        {/* {hasMultipleCategories && (
          <>
            <Button
              variant='ghost'
              size='icon'
              className='absolute left-2 top-1/2 -translate-y-1/2 shadow-sm bg-white/60 backdrop-blur hover:bg-white/80'
              onClick={() => onNavigate(-1)}
              aria-label='Previous category'
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='absolute right-2 top-1/2 -translate-y-1/2 shadow-sm bg-white/60 backdrop-blur hover:bg-white/80'
              onClick={() => onNavigate(1)}
              aria-label='Next category'
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </>
        )} */}

        <DialogHeader className='relative pb-2'>
          {hasMultipleCategories && (
            <>
              <Button
                variant='ghost'
                size='icon'
                className='absolute -left-1 top-1/2 translate-y-0  bg-transparent backdrop-blur hover:bg-primary/40'
                onClick={() => onNavigate(-1)}
                aria-label='Previous category'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='absolute -right-1 top-1/2 translate-y-0  bg-transparent backdrop-blur hover:bg-primary/40'
                onClick={() => onNavigate(1)}
                aria-label='Next category'
              >
                <ChevronRight className='h-4 w-4 hover:text-secondary' />
              </Button>
            </>
          )}
          <DialogTitle className='flex flex-col items-center gap-2 text-center text-xl'>
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center',
                'overflow-hidden'
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, ${category.gradient.from}, ${category.gradient.to})`,
              }}
            >
              <Icon className='w-4 h4 text-slate-700' />
            </div>
            <span className='text-pretty'>{category.title}</span>
          </DialogTitle>
          <div className='absolute left-0 top-1 -translate-y-1/2'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-primary rounded-full bg-transparent backdrop-blur hover:bg-white/10 hover:text-gray-700 cursor-pointer'
                  disabled={isLoadingVoices || voices.length === 0}
                  aria-label='Select voice'
                >
                  {/* <Headphones className='h-4 w-4' /> */}
                  <Mic className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                {voices.length === 0 ? (
                  <DropdownMenuItem disabled>
                    {isLoadingVoices
                      ? 'Loading voices…'
                      : 'No voices available'}
                  </DropdownMenuItem>
                ) : (
                  voices.map((voice) => (
                    <DropdownMenuItem
                      key={voice.id}
                      onSelect={() => setSelectedVoice(voice.id)}
                      className='flex items-center justify-between gap-3'
                    >
                      <span>{voice.name}</span>
                      {selectedVoice === voice.id && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          <div className='relative'>
            {isGenerating ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-primary' />
              </div>
            ) : (
              <blockquote className='text-md md:text-md font-small text-center text-balance leading-relaxed text-foreground px-4 py-8 bg-muted/30 rounded-2xl'>
                “{affirmation}”
              </blockquote>
            )}
          </div>

          {generatedImage && (
            <div className='rounded-2xl overflow-hidden border border-border/40'>
              <img
                src={generatedImage}
                alt='Affirmation visualization'
                className='w-full h-auto'
              />
            </div>
          )}

          {/* <div className='grid grid-cols-4 gap-1 flex justify-center items-center'> */}
          <div className='flex justify-center items-center gap-6'>
            <Button
              variant='outline'
              onClick={generateAffirmation}
              disabled={isGenerating}
              // className='gap-2 bg-transparent'
              className='gap-2 bg-transparent w-10 bg-primary/20 hover:bg-primary/80 hover:cursor-pointer'
            >
              <RefreshCw
                className={cn('w-4 h-4', isGenerating && 'animate-spin')}
              />
              {/* Regenerate */}
            </Button>

            <Button
              variant='outline'
              onClick={speakAffirmation}
              disabled={isGenerating || !affirmation}
              // className='gap-2 bg-transparent'
              className='gap-2 bg-transparent w-10 bg-blue-200/60 hover:bg-blue-400 hover:cursor-pointer'
            >
              {isSpeaking ? (
                <Square className='h-4 w-4' />
              ) : (
                <Volume2 className='h-4 w-4' />
              )}
            </Button>

            <Button
              variant='outline'
              onClick={generateImage}
              disabled={isGenerating || isGeneratingImage || !affirmation}
              // className='gap-2 bg-transparent'
              className='gap-2 bg-transparent w-10 bg-yellow-200/60 hover:bg-yellow-300/60 hover:cursor-pointer'
            >
              <ImageIcon
                className={cn('w-4 h-4', isGeneratingImage && 'animate-spin')}
              />
              {/* {isGeneratingImage ? 'Generating...' : 'Generate Image'} */}
            </Button>

            <Button
              variant='outline'
              onClick={toggleFavorite}
              disabled={isGenerating || !affirmation || isSavingFavorite}
              className={cn(
                'gap-2 bg-transparent w-10 hover:cursor-pointer',
                isFavorite
                  ? 'bg-red-300/70 hover:bg-red-400/80'
                  : 'bg-red-200/60 hover:bg-red-300/60'
              )}
            >
              {isFavorite ? (
                <BookmarkCheck className='w-4 h-4' />
              ) : (
                <Bookmark className='w-4 h-4' />
              )}
            </Button>
          </div>

          <div className='mt-4 rounded-2xl border border-border/40 bg-muted/10 p-4'>
            {/* <div className='mt-4 rounded-2xl border border-border/40 bg-muted/10 p-4 shadow-sm'></div> */}
            <p className='mb-3 text-sm font-medium text-muted-foreground text-center'>
              Personalize your experience
            </p>
            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-4'>
                <Label
                  htmlFor='toggle-my-image'
                  className='text-sm font-medium text-foreground'
                >
                  In my image
                </Label>
                <Switch
                  id='toggle-my-image'
                  checked={false}
                  onCheckedChange={() => handleUnavailableFeature('image')}
                />
              </div>
              <div className='flex items-center justify-between gap-4'>
                <Label
                  htmlFor='toggle-my-voice'
                  className='text-sm font-medium text-foreground'
                >
                  In my voice
                </Label>
                <Switch
                  id='toggle-my-voice'
                  checked={false}
                  onCheckedChange={() => handleUnavailableFeature('voice')}
                />
              </div>
            </div>
          </div>
        </div>

        <AlertDialog
          open={pendingFeature !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingFeature(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingFeature
                  ? featureDescriptions[pendingFeature].title
                  : ''}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingFeature
                  ? featureDescriptions[pendingFeature].description
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingFeature(null)}>
                Not now
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // Placeholder: hook into auth flow later
                  setPendingFeature(null);
                }}
              >
                Sign up / Log in
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
