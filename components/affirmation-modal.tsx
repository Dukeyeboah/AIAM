'use client';

import { useEffect, useRef, useState } from 'react';
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
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [imagePrompt, setImagePrompt] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  const generateAffirmation = async () => {
    if (!category) return;

    setIsGenerating(true);
    setGeneratedImage(null);
    setImagePrompt(null);

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

  const pollPrediction = async (predictionId: string) => {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt === 0 ? 1000 : 1500)
      );

      const statusResponse = await fetch(`/api/generate-image/${predictionId}`);
      if (!statusResponse.ok) {
        throw new Error('Unable to monitor image generation status.');
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'succeeded') {
        if (Array.isArray(statusData.output) && statusData.output.length > 0) {
          return statusData.output[0] as string;
        }
        throw new Error('Image generation completed without output.');
      }

      if (statusData.status === 'failed' || statusData.status === 'canceled') {
        throw new Error(
          statusData.detail ?? 'Image generation failed. Please try again.'
        );
      }
    }

    throw new Error('Image generation timed out. Try again in a moment.');
  };

  const generateImage = async () => {
    if (!affirmation || !category) return;

    setIsGeneratingImage(true);
    setGeneratedImage(null);
    setImagePrompt(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affirmation,
          category: category.title,
          categoryId: category.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to start image generation.');
      }

      const data = await response.json();
      if (data.prompt) {
        setImagePrompt(data.prompt);
      }

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        return;
      }

      if (data.predictionId) {
        const imageUrl = await pollPrediction(data.predictionId as string);
        setGeneratedImage(imageUrl);
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

  const bookmarkAffirmation = () => {
    if (!affirmation || !category) return;

    const bookmarks = JSON.parse(localStorage.getItem('affirmations') || '[]');
    const newBookmark = {
      id: Date.now(),
      category: category.title,
      affirmation,
      image: generatedImage,
      createdAt: new Date().toISOString(),
    };

    bookmarks.push(newBookmark);
    localStorage.setItem('affirmations', JSON.stringify(bookmarks));

    toast({
      title: 'Bookmarked!',
      description: 'Affirmation saved to your collection.',
    });
  };

  useEffect(() => {
    if (!open) {
      stopAudioPlayback();
      setGeneratedImage(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='relative max-w-2xl max-h-[80vh] overflow-y-auto'>
        {hasMultipleCategories && (
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
        )}

        <DialogHeader className='relative pb-2'>
          <DialogTitle className='flex flex-col items-center gap-4 text-center text-2xl'>
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'overflow-hidden'
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, ${category.gradient.from}, ${category.gradient.to})`,
              }}
            >
              <Icon className='w-6 h-6 text-slate-700' />
            </div>
            <span className='text-pretty'>{category.title}</span>
          </DialogTitle>
          <div className='absolute right-0 top-1/2 -translate-y-1/2'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='rounded-full bg-white/60 backdrop-blur hover:bg-white/80 shadow-sm'
                  disabled={isLoadingVoices || voices.length === 0}
                  aria-label='Select voice'
                >
                  <Headphones className='h-4 w-4' />
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
              <blockquote className='text-xl md:text-2xl font-medium text-center text-balance leading-relaxed text-foreground px-4 py-8 bg-muted/30 rounded-2xl'>
                “{affirmation}”
              </blockquote>
            )}
          </div>

          {imagePrompt && (
            <p className='text-sm text-muted-foreground text-center'>
              Image prompt: {imagePrompt}
            </p>
          )}

          {generatedImage && (
            <div className='rounded-2xl overflow-hidden border border-border/40'>
              <img
                src={generatedImage}
                alt='Affirmation visualization'
                className='w-full h-auto'
              />
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <Button
              variant='outline'
              onClick={generateAffirmation}
              disabled={isGenerating}
              className='gap-2 bg-transparent'
            >
              <RefreshCw
                className={cn('w-4 h-4', isGenerating && 'animate-spin')}
              />
              Regenerate
            </Button>

            <Button
              variant='outline'
              onClick={speakAffirmation}
              disabled={isGenerating || !affirmation}
              className='gap-2 bg-transparent'
            >
              <Volume2
                className={cn('w-4 h-4', isSpeaking && 'animate-pulse')}
              />
              {isSpeaking ? 'Stop' : 'Play'}
            </Button>

            <Button
              variant='outline'
              onClick={generateImage}
              disabled={isGenerating || isGeneratingImage || !affirmation}
              className='gap-2 bg-transparent'
            >
              <ImageIcon
                className={cn('w-4 h-4', isGeneratingImage && 'animate-pulse')}
              />
              {isGeneratingImage ? 'Generating...' : 'Generate Image'}
            </Button>

            <Button
              variant='outline'
              onClick={bookmarkAffirmation}
              disabled={isGenerating || !affirmation}
              className='gap-2 bg-transparent'
            >
              <Bookmark className='w-4 h-4' />
              Bookmark
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
