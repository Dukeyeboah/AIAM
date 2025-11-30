'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ChevronDown,
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
import { useAuth } from '@/providers/auth-provider';
import { firebaseDb, firebaseStorage } from '@/lib/firebase/client';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  calculateCreditCost,
  hasEnoughCredits,
  isLowOnCredits,
  getRemainingAffirmations,
  BASE_AFFIRMATION_COST,
  PERSONAL_IMAGE_COST,
  VOICE_CLONE_COST,
} from '@/lib/credit-utils';

interface VoiceOption {
  id: string;
  name: string;
  description?: string;
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
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [affirmationDocId, setAffirmationDocId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioUrlIsObjectRef = useRef(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [useMyImage, setUseMyImage] = useState(false);
  const [useMyVoice, setUseMyVoice] = useState(false);
  const [autoGenerateImages, setAutoGenerateImages] = useState(true);
  const personalImageManuallyDisabledRef = useRef(false);

  const userAffirmationsCollection = useMemo(() => {
    if (!user) return null;
    return collection(firebaseDb, 'users', user.uid, 'affirmations');
  }, [user]);

  const hasPersonalImages = useMemo(
    () => Boolean(profile?.portraitImageUrl || profile?.fullBodyImageUrl),
    [profile?.portraitImageUrl, profile?.fullBodyImageUrl]
  );

  // Debug: Log profile image URLs when they change
  useEffect(() => {
    console.log('[AffirmationModal] Profile image URLs:', {
      hasProfile: !!profile,
      portraitImageUrl: profile?.portraitImageUrl,
      fullBodyImageUrl: profile?.fullBodyImageUrl,
      hasPersonalImages,
    });
  }, [
    profile?.portraitImageUrl,
    profile?.fullBodyImageUrl,
    hasPersonalImages,
    profile,
  ]);

  // Refresh profile when modal opens to ensure we have latest image URLs
  useEffect(() => {
    if (open && user && refreshProfile) {
      console.log('[AffirmationModal] Refreshing profile on modal open...');
      refreshProfile().catch((error) => {
        console.error('[AffirmationModal] Failed to refresh profile:', error);
      });
    }
  }, [open, user, refreshProfile]);

  const hasPersonalVoice = useMemo(
    () => Boolean(profile?.voiceCloneId),
    [profile?.voiceCloneId]
  );

  const demographicContext = useMemo(() => {
    if (!profile) return undefined;
    const { ageRange, gender, ethnicity, nationality } = profile;
    if (!ageRange && !gender && !ethnicity && !nationality) return undefined;
    return {
      ageRange: ageRange ?? undefined,
      gender: gender ?? undefined,
      ethnicity: ethnicity ?? undefined,
      nationality: nationality ?? undefined,
    };
  }, [profile]);

  useEffect(() => {
    setAutoGenerateImages(
      profile?.autoGenerateImages === undefined
        ? true
        : Boolean(profile.autoGenerateImages)
    );
  }, [profile?.autoGenerateImages]);

  useEffect(() => {
    if (
      open &&
      hasPersonalImages &&
      !personalImageManuallyDisabledRef.current
    ) {
      setUseMyImage(true);
    }

    if (!hasPersonalImages) {
      personalImageManuallyDisabledRef.current = false;
      setUseMyImage(false);
    }
  }, [open, hasPersonalImages]);

  const resetAffirmationState = () => {
    setAffirmation('');
    setGeneratedImage(null);
    setAffirmationDocId(null);
    setIsFavorite(false);
    setAudioUrls({});
    personalImageManuallyDisabledRef.current = false;
    setUseMyImage(false);
    setUseMyVoice(false);
  };

  const generateAffirmation = async () => {
    if (!category) return;
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description:
          'You need an AiAm account to generate and save affirmations.',
        variant: 'destructive',
      });
      return;
    }

    // Calculate credit cost including image (base cost includes image)
    // If auto-generate is ON and user has personal images, include personal image cost
    // because auto-generate will use personal images if available
    const willUsePersonalImage = autoGenerateImages
      ? hasPersonalImages && !personalImageManuallyDisabledRef.current
      : useMyImage && hasPersonalImages;

    const creditCost = calculateCreditCost({
      usePersonalImage: willUsePersonalImage,
      useVoiceClone: useMyVoice && hasPersonalVoice,
    });

    if (
      !hasEnoughCredits(profile.credits, {
        usePersonalImage: willUsePersonalImage,
        useVoiceClone: useMyVoice && hasPersonalVoice,
      })
    ) {
      toast({
        title: 'Insufficient aiams',
        description: `You need ${creditCost.total} aiams to generate this affirmation. You currently have ${profile.credits} aiams.`,
        variant: 'destructive',
      });
      router.push('/account?purchase=credits');
      return;
    }

    if (
      isLowOnCredits(profile.credits) &&
      getRemainingAffirmations(profile.credits) === 1
    ) {
      toast({
        title: 'Running low on aiams',
        description: `You have ${profile.credits} aiams remaining. Consider purchasing more to continue your journey.`,
        variant: 'default',
      });
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
            audioUrls: {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setAffirmationDocId(docRef.id);
          setAudioUrls({});

          // Deduct credits (base cost includes image generation)
          // If auto-generate is on, generate image automatically
          // If auto-generate is off, user can generate manually later (no extra charge)
          const newCredits = profile.credits - creditCost.total;
          const userDocRef = doc(firebaseDb, 'users', user.uid);
          await updateDoc(userDocRef, {
            credits: newCredits,
            updatedAt: serverTimestamp(),
          });
          await refreshProfile();

          // If auto-generate images is on, generate image automatically
          if (autoGenerateImages) {
            console.log(
              '[AffirmationModal] Auto-generating image for affirmation:',
              data.affirmation.substring(0, 50)
            );
            // Auto-generate will use personal images if available
            // Set useMyImage to true if personal images are available
            const shouldUsePersonalImages =
              hasPersonalImages && !personalImageManuallyDisabledRef.current;
            if (shouldUsePersonalImages) {
              setUseMyImage(true);
            }
            // Pass affirmation text and useMyImage flag directly to avoid state timing issues
            generateImage({
              docId: docRef.id,
              silent: true,
              affirmationText: data.affirmation,
              forceUsePersonalImages: shouldUsePersonalImages,
            }).catch((error) => {
              console.error(
                '[AffirmationModal] Auto image generation error:',
                error
              );
            });
          } else {
            console.log(
              '[AffirmationModal] Auto-generate images is OFF, skipping automatic image generation'
            );
          }
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

  const persistGeneratedImage = async (
    imageUrl: string,
    targetDocId?: string | null
  ) => {
    if (!user || !targetDocId) {
      return imageUrl;
    }

    try {
      const response = await fetch(imageUrl, {
        mode: 'cors',
        credentials: 'omit',
      });
      if (!response.ok) {
        console.warn(
          '[AffirmationModal] Image fetch failed, using original URL',
          response.status
        );
        return imageUrl;
      }
      const blob = await response.blob();
      const extension = blob.type?.split('/')?.[1] ?? 'jpg';
      const storageRef = ref(
        firebaseStorage,
        `users/${
          user.uid
        }/affirmations/${targetDocId}/images/generated-${Date.now()}.${extension}`
      );
      await uploadBytes(storageRef, blob, {
        contentType: blob.type ?? 'image/jpeg',
      });
      const downloadUrl = await getDownloadURL(storageRef);
      await updateDoc(
        doc(firebaseDb, 'users', user.uid, 'affirmations', targetDocId),
        {
          imageUrl: downloadUrl,
          updatedAt: serverTimestamp(),
        }
      );
      return downloadUrl;
    } catch (error) {
      console.error('[AffirmationModal] Failed to persist image', error);
      return imageUrl;
    }
  };

  const generateImage = async (options?: {
    docId?: string;
    silent?: boolean;
    affirmationText?: string;
    forceUsePersonalImages?: boolean;
  }) => {
    const affirmationToUse = options?.affirmationText ?? affirmation;
    if (!options?.silent) {
      console.log('[AffirmationModal] generateImage called', {
        hasAffirmation: !!affirmationToUse,
        hasCategory: !!category,
        useMyImage,
        hasPersonalImages,
      });
    }
    if (!affirmationToUse || !category) {
      if (!options?.silent) {
        console.warn(
          '[AffirmationModal] Cannot generate image: missing affirmation or category'
        );
      } else {
        console.warn(
          '[AffirmationModal] Auto image generation skipped: missing affirmation or category',
          {
            hasAffirmation: !!affirmationToUse,
            hasCategory: !!category,
          }
        );
      }
      return;
    }
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description:
          'Create an account or log in to generate images with your affirmations.',
        variant: 'destructive',
      });
      return;
    }

    // If called manually (not during auto-generate), check credits
    // Note: Base cost (20) already includes image generation, so manual generation
    // only charges extra if using personal images (+10)
    if (!options?.silent) {
      const additionalCost =
        useMyImage && hasPersonalImages ? PERSONAL_IMAGE_COST : 0;

      if (additionalCost > 0 && profile.credits < additionalCost) {
        toast({
          title: 'Insufficient aiams',
          description: `Personal image generation requires ${PERSONAL_IMAGE_COST} additional aiams. You currently have ${profile.credits} aiams.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const targetDocId = options?.docId ?? affirmationDocId;

      // Determine if we should use personal images
      // Use the forced value if provided (for auto-generate), otherwise use state
      const shouldUsePersonalImages =
        options?.forceUsePersonalImages !== undefined
          ? options.forceUsePersonalImages
          : useMyImage && hasPersonalImages;

      const requestBody = {
        affirmation: affirmationToUse,
        category: category.title,
        categoryId: category.id,
        useUserImages: shouldUsePersonalImages,
        userImages: shouldUsePersonalImages
          ? {
              portrait: profile?.portraitImageUrl,
              fullBody: profile?.fullBodyImageUrl,
            }
          : undefined,
        aspectRatio: profile?.defaultAspectRatio ?? '1:1',
        demographics: !shouldUsePersonalImages
          ? profile?.tier === 'starter'
            ? undefined
            : demographicContext
          : // Even when using personal images, include demographics for other characters in the scene
            demographicContext,
      };

      // Log what we're sending (for debugging)
      console.log('[AffirmationModal] Generating image with:', {
        useUserImages: requestBody.useUserImages,
        shouldUsePersonalImages,
        useMyImage,
        hasPersonalImages,
        hasPortrait: !!requestBody.userImages?.portrait,
        hasFullBody: !!requestBody.userImages?.fullBody,
        portraitUrl: requestBody.userImages?.portrait ? 'present' : 'missing',
        fullBodyUrl: requestBody.userImages?.fullBody ? 'present' : 'missing',
        portraitImageUrl: profile?.portraitImageUrl,
        fullBodyImageUrl: profile?.fullBodyImageUrl,
        category: requestBody.category,
        aspectRatio: requestBody.aspectRatio,
      });

      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        const storedUrl = await persistGeneratedImage(
          data.imageUrl,
          targetDocId ?? undefined
        );
        setGeneratedImage(storedUrl);

        // If called manually, only charge extra for personal images (+10)
        // Base cost (20) already includes generic image generation
        if (!options?.silent && profile) {
          const additionalCost =
            useMyImage && hasPersonalImages ? PERSONAL_IMAGE_COST : 0;
          if (additionalCost > 0) {
            const newCredits = profile.credits - additionalCost;
            const userDocRef = doc(firebaseDb, 'users', user.uid);
            await updateDoc(userDocRef, {
              credits: newCredits,
              updatedAt: serverTimestamp(),
            });
            await refreshProfile();
          }
        }

        return;
      }

      throw new Error('Image generation response was incomplete.');
    } catch (error) {
      console.error('[AffirmationModal] Error generating image:', error);
      if (!options?.silent) {
        toast({
          title: 'Image generation failed',
          description:
            error instanceof Error
              ? error.message
              : 'Something went wrong while creating the image. Please try again.',
          variant: 'destructive',
        });
      } else {
        // Log silently for auto-generation failures
        console.warn('[AffirmationModal] Auto image generation failed:', error);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current && audioUrlIsObjectRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = null;
    audioUrlIsObjectRef.current = false;
    setIsSpeaking(false);
  };

  const cacheAudioForVoice = async (voiceId: string, blob: Blob) => {
    if (!user || !affirmationDocId) return null;
    try {
      const storageRef = ref(
        firebaseStorage,
        `users/${user.uid}/affirmations/${affirmationDocId}/audio/${voiceId}.mp3`
      );
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      const docRef = doc(
        firebaseDb,
        'users',
        user.uid,
        'affirmations',
        affirmationDocId
      );
      await updateDoc(docRef, {
        [`audioUrls.${voiceId}`]: downloadUrl,
        updatedAt: serverTimestamp(),
      });
      setAudioUrls((prev) => ({ ...prev, [voiceId]: downloadUrl }));
      return downloadUrl;
    } catch (error) {
      console.error('[AffirmationModal] Failed to cache audio', error);
      return null;
    }
  };

  const speakAffirmation = async () => {
    if (!affirmation) return;

    if (audioRef.current && !audioRef.current.paused) {
      stopAudioPlayback();
      return;
    }

    let voiceToUse: string | null = null;
    if (useMyVoice) {
      if (!hasPersonalVoice || !profile?.voiceCloneId) {
        toast({
          title: 'Upload your reference voice',
          description:
            'Add a 30-second voice sample in account settings to enable personal playback.',
        });
        router.push('/account?setup=voice');
        setUseMyVoice(false);
        return;
      }
      voiceToUse = profile.voiceCloneId;
    } else {
      voiceToUse = selectedVoice;
    }

    if (!voiceToUse) {
      toast({
        title: 'Select a voice',
        description: 'Please choose a voice to play the affirmation.',
        variant: 'default',
      });
      return;
    }

    const cachedUrl = audioUrls[voiceToUse];
    if (cachedUrl) {
      try {
        stopAudioPlayback();
        setIsSpeaking(true);
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = cachedUrl;
        audioUrlRef.current = cachedUrl;
        audioUrlIsObjectRef.current = false;
        audioRef.current.onended = stopAudioPlayback;
        audioRef.current.onerror = stopAudioPlayback;
        await audioRef.current.play();
        return;
      } catch (error) {
        console.error('[AffirmationModal] Failed to play cached audio', error);
        toast({
          title: 'Playback failed',
          description:
            error instanceof Error
              ? error.message
              : 'Something went wrong while playing the affirmation.',
          variant: 'destructive',
        });
        stopAudioPlayback();
        return;
      }
    }

    try {
      setIsSpeaking(true);
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: affirmation,
          voiceId: voiceToUse,
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
      audioUrlIsObjectRef.current = true;

      audioRef.current.onended = () => {
        stopAudioPlayback();
      };
      audioRef.current.onerror = () => {
        stopAudioPlayback();
      };

      setIsSpeaking(true);
      await audioRef.current.play();

      void cacheAudioForVoice(voiceToUse, audioBlob);
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
            description: voice.description ?? voice.labels?.description ?? '',
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
    if (useMyVoice && !hasPersonalVoice) {
      setUseMyVoice(false);
    }
  }, [useMyVoice, hasPersonalVoice]);

  // Set useMyVoice default based on account settings
  useEffect(() => {
    if (
      open &&
      profile?.useMyVoiceByDefault &&
      hasPersonalVoice &&
      profile?.voiceCloneId
    ) {
      setUseMyVoice(true);
    } else if (!profile?.useMyVoiceByDefault) {
      // Only reset if the default is explicitly false
      // Don't reset if it's undefined (to preserve user's manual toggle)
      if (profile?.useMyVoiceByDefault === false) {
        setUseMyVoice(false);
      }
    }
  }, [
    open,
    profile?.useMyVoiceByDefault,
    hasPersonalVoice,
    profile?.voiceCloneId,
  ]);

  useEffect(() => {
    if (!affirmationDocId || !user) {
      return;
    }

    const fetchAudio = async () => {
      try {
        const docRef = doc(
          firebaseDb,
          'users',
          user.uid,
          'affirmations',
          affirmationDocId
        );
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const audioMap = data?.audioUrls;
          if (audioMap && typeof audioMap === 'object') {
            const formatted = Object.entries(audioMap).reduce<
              Record<string, string>
            >((acc, [key, value]) => {
              if (typeof value === 'string') {
                acc[key] = value;
              }
              return acc;
            }, {});
            setAudioUrls(formatted);
          }
        }
      } catch (error) {
        console.error('[AffirmationModal] Failed to load cached audio', error);
      }
    };

    fetchAudio();
  }, [affirmationDocId, user]);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!category) return null;

  const Icon = category.icon;
  const hasMultipleCategories = categories.length > 1;
  const handleUseMyImageToggle = (checked: boolean) => {
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description: 'Log in to use personal imagery.',
        variant: 'destructive',
      });
      return;
    }

    if (checked && !hasPersonalImages) {
      toast({
        title: 'Upload your reference photos',
        description:
          'Add a close-up and full-body photo in account settings to use personal imagery.',
      });
      router.push('/account?setup=images');
      setUseMyImage(false);
      return;
    }

    if (checked) {
      const cost = calculateCreditCost({
        usePersonalImage: true,
        useVoiceClone: useMyVoice && hasPersonalVoice,
      });
      if (!hasEnoughCredits(profile.credits, { usePersonalImage: true })) {
        toast({
          title: 'Insufficient aiams',
          description: `Personal image generation requires ${PERSONAL_IMAGE_COST} additional aiams. You need ${cost.total} total.`,
          variant: 'destructive',
        });
        router.push('/account?purchase=credits');
        setUseMyImage(false);
        return;
      }
    }

    personalImageManuallyDisabledRef.current = !checked;
    setUseMyImage(checked);
  };

  const handleUseMyVoiceToggle = (checked: boolean) => {
    if (checked) {
      if (!user || !profile) {
        toast({
          title: 'Sign in required',
          description: 'Log in to use your personal voice.',
          variant: 'destructive',
        });
        return;
      }

      if (!hasPersonalVoice || !profile?.voiceCloneId) {
        toast({
          title: 'Upload your reference voice',
          description:
            'Add a 30-second voice sample in account settings to enable personal playback.',
        });
        router.push('/account?setup=voice');
        setUseMyVoice(false);
        return;
      }

      const cost = calculateCreditCost({
        usePersonalImage: useMyImage && hasPersonalImages,
        useVoiceClone: true,
      });
      if (!hasEnoughCredits(profile.credits, { useVoiceClone: true })) {
        toast({
          title: 'Insufficient aiams',
          description: `Voice clone playback requires ${VOICE_CLONE_COST} additional aiams. You need ${cost.total} total.`,
          variant: 'destructive',
        });
        router.push('/account?purchase=credits');
        setUseMyVoice(false);
        return;
      }

      setUseMyVoice(true);
    } else {
      setUseMyVoice(false);
    }
  };

  const handleAutoGenerateImagesToggle = async (checked: boolean) => {
    setAutoGenerateImages(checked);
    if (!user) return;

    try {
      await updateDoc(doc(firebaseDb, 'users', user.uid), {
        autoGenerateImages: checked,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
    } catch (error) {
      console.error(
        '[AffirmationModal] Failed to update auto-generate preference',
        error
      );
    }
  };

  const isProcessing = isGenerating || isGeneratingImage;

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // Prevent closing during generation
        if (!newOpen && isProcessing) {
          return;
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto rounded-2xl'>
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
                disabled={isProcessing}
                aria-label='Previous category'
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='absolute -right-1 top-1/2 translate-y-0  bg-transparent backdrop-blur hover:bg-primary/40'
                onClick={() => onNavigate(1)}
                disabled={isProcessing}
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
          <div className='absolute left-0 top-1 -translate-y-1/2 flex items-center gap-2'>
            {useMyVoice && hasPersonalVoice && (
              <Badge className='bg-purple-500/80 text-white border-transparent text-xs px-2 py-0.5'>
                Your Voice
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={useMyVoice}>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-primary rounded-full bg-transparent backdrop-blur hover:bg-white/10 hover:text-gray-700 cursor-pointer'
                  disabled={
                    useMyVoice || isLoadingVoices || voices.length === 0
                  }
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
                      onSelect={() => !useMyVoice && setSelectedVoice(voice.id)}
                      className='flex items-start justify-between gap-3'
                      disabled={useMyVoice}
                    >
                      <div className='flex flex-col text-left'>
                        <span>{voice.name}</span>
                        {voice.description && (
                          <span className='text-xs text-muted-foreground'>
                            {voice.description}
                          </span>
                        )}
                      </div>
                      {selectedVoice === voice.id && !useMyVoice && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className='space-y-2 py-0'>
          <div className='relative'>
            {isGenerating ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 animate-spin text-primary' />
              </div>
            ) : (
              <blockquote className='text-md md:text-md font-small text-center text-balance leading-relaxed text-foreground px-4 py-1 bg-muted/30 rounded-2xl'>
                “{affirmation}”
              </blockquote>
            )}
          </div>

          {(generatedImage || (autoGenerateImages && isGeneratingImage)) && (
            <div className='rounded-3xl overflow-hidden border border-none flex items-center justify-center relative'>
              {isGeneratingImage && !generatedImage ? (
                <div className='w-full h-80 flex flex-col items-center justify-center gap-3 bg-muted/30 rounded-md'>
                  <Loader2 className='h-8 w-8 animate-spin text-primary' />
                  <p className='text-sm text-muted-foreground'>
                    Generating your image...
                  </p>
                </div>
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt='Affirmation visualization'
                  className='w-auto h-80 object-contain rounded-md'
                />
              ) : null}
            </div>
          )}

          <div className='flex flex-wrap items-center justify-center gap-3'>
            <Button
              variant='outline'
              onClick={generateAffirmation}
              disabled={isGenerating}
              className='gap-2 bg-transparent w-10 bg-primary/20 hover:bg-primary/80 hover:cursor-pointer'
            >
              <RefreshCw
                className={cn('w-4 h-4', isGenerating && 'animate-spin')}
              />
            </Button>

            <Button
              variant='outline'
              onClick={speakAffirmation}
              disabled={isProcessing || !affirmation}
              className='gap-2 bg-transparent w-10 bg-blue-200/60 hover:bg-blue-400 hover:cursor-pointer'
            >
              {isSpeaking ? (
                <Square className='h-4 w-4' />
              ) : (
                <Volume2 className='h-4 w-4' />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                disabled={useMyVoice || isLoadingVoices || voices.length === 0}
              >
                <Button
                  variant='outline'
                  className='gap-2 bg-transparent w-10 bg-purple-200/60 hover:bg-purple-300/70 hover:cursor-pointer'
                >
                  <Mic className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className='w-56'>
                {voices.map((voice) => (
                  <DropdownMenuItem
                    key={voice.id}
                    onSelect={() => !useMyVoice && setSelectedVoice(voice.id)}
                    className='flex flex-col items-start gap-1'
                    disabled={useMyVoice}
                  >
                    <span className='flex items-center justify-between w-full'>
                      {voice.name}
                      {selectedVoice === voice.id && !useMyVoice && (
                        <Check className='h-4 w-4 text-primary' />
                      )}
                    </span>
                    {voice.description && (
                      <span className='text-xs text-muted-foreground'>
                        {voice.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant='outline'
              onClick={() => void generateImage()}
              disabled={
                isGenerating ||
                isGeneratingImage ||
                !affirmation ||
                (autoGenerateImages && generatedImage !== null) ||
                (autoGenerateImages && isGeneratingImage)
              }
              className='gap-2 bg-transparent w-10 bg-yellow-200/60 hover:bg-yellow-300/60 hover:cursor-pointer'
              title={
                autoGenerateImages && generatedImage !== null
                  ? 'Image already generated automatically'
                  : autoGenerateImages && isGeneratingImage
                  ? 'Generating image...'
                  : 'Generate image'
              }
            >
              <ImageIcon
                className={cn('w-4 h-4', isGeneratingImage && 'animate-spin')}
              />
            </Button>

            <Button
              variant='outline'
              onClick={toggleFavorite}
              disabled={isGenerating || !affirmation || isSavingFavorite}
              className='gap-2 bg-transparent w-10 bg-red-200/60 hover:bg-red-300/60 hover:cursor-pointer'
            >
              {isFavorite ? (
                <BookmarkCheck className='w-4 h-4' />
              ) : (
                <Bookmark className='w-4 h-4' />
              )}
            </Button>
          </div>

          <Collapsible
            open={personalizeOpen}
            onOpenChange={setPersonalizeOpen}
            className='rounded-2xl border border-border/40 bg-muted/10 px-3 py-1'
          >
            <div className='flex items-center justify-between'>
              <p className='text-sm font-medium text-muted-foreground'>
                Personalize your experience
              </p>
              <CollapsibleTrigger asChild>
                <Button variant='ghost' size='icon'>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      personalizeOpen ? 'rotate-180' : ''
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className='space-y-3 pt-3'>
              <div className='flex items-center justify-between gap-4'>
                <Label
                  htmlFor='toggle-my-image'
                  className='text-sm font-medium text-foreground'
                >
                  In my image
                </Label>
                <Switch
                  id='toggle-my-image'
                  checked={useMyImage}
                  onCheckedChange={handleUseMyImageToggle}
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
                  checked={useMyVoice}
                  onCheckedChange={handleUseMyVoiceToggle}
                />
              </div>
              <div className='flex items-center justify-between gap-4'>
                <Label
                  htmlFor='toggle-auto-images'
                  className='text-sm font-medium text-foreground'
                >
                  Auto-generate images
                </Label>
                <Switch
                  id='toggle-auto-images'
                  checked={autoGenerateImages}
                  onCheckedChange={handleAutoGenerateImagesToggle}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
