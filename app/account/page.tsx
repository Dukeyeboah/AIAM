'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  UploadCloud,
  Wand2,
  Mic,
  StopCircle,
  Trash2,
} from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import {
  firebaseAuth,
  firebaseDb,
  firebaseStorage,
} from '@/lib/firebase/client';
import {
  AGE_OPTIONS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
} from '@/lib/demographics';
import { Switch } from '@/components/ui/switch';
import {
  BASE_AFFIRMATION_COST,
  PERSONAL_IMAGE_COST,
  VOICE_CLONE_COST,
} from '@/lib/credit-utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { loadStripe, type Stripe as StripeType } from '@stripe/stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.warn(
    '[AccountPage] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe checkout will not work.'
  );
}

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export const CREDIT_PACKS = [
  {
    id: 'starter',
    title: 'Starter',
    description: '500 aiams • ~25 affirmations',
    price: '$5.99',
    credits: 500,
    costPer100: '$5.99',
  },
  {
    id: 'creator',
    title: 'Creator',
    description: '1,200 aiams • ~60 affirmations',
    price: '$9.99',
    credits: 1200,
    costPer100: '$0.83',
  },
  {
    id: 'visionary',
    title: 'Visionary',
    description: '2,000 aiams • ~100 affirmations',
    price: '$16.99',
    credits: 2000,
    costPer100: '$0.75',
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]['id'];

export default function AccountPage() {
  const { user, profile, refreshProfile, authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [fullBodyPreview, setFullBodyPreview] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState<string | undefined>(undefined);
  const [gender, setGender] = useState<string | undefined>(undefined);
  const [ethnicity, setEthnicity] = useState<string | undefined>(undefined);
  const [nationality, setNationality] = useState('');
  const [autoGenerateImagesPref, setAutoGenerateImagesPref] = useState(true);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState('1:1');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [uploadingFullBody, setUploadingFullBody] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const referenceSectionRef = useRef<HTMLDivElement | null>(null);
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);
  const [voiceCloneName, setVoiceCloneName] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [savingAutoGenerate, setSavingAutoGenerate] = useState(false);
  const [autoGenerateConfirmOpen, setAutoGenerateConfirmOpen] = useState(false);
  const [hasNewVoiceFile, setHasNewVoiceFile] = useState(false);

  useEffect(() => {
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    }
    if (profile?.photoURL) {
      setPhotoPreview(profile.photoURL);
    }
    if (profile?.portraitImageUrl) {
      setPortraitPreview(profile.portraitImageUrl);
    }
    if (profile?.fullBodyImageUrl) {
      setFullBodyPreview(profile.fullBodyImageUrl);
    }
    if (profile?.voiceCloneId) {
      setVoiceCloneId(profile.voiceCloneId);
    }
    if (profile?.voiceCloneName) {
      setVoiceCloneName(profile.voiceCloneName);
    }
    // Reset new voice file flag when profile loads
    setHasNewVoiceFile(false);
    setAgeRange(profile?.ageRange ?? undefined);
    setGender(profile?.gender ?? undefined);
    setEthnicity(profile?.ethnicity ?? undefined);
    setNationality(profile?.nationality ?? '');
    setAutoGenerateImagesPref(
      profile?.autoGenerateImages === undefined
        ? true
        : Boolean(profile.autoGenerateImages)
    );
    setDefaultAspectRatio(profile?.defaultAspectRatio ?? '1:1');
  }, [
    profile?.displayName,
    profile?.photoURL,
    profile?.portraitImageUrl,
    profile?.fullBodyImageUrl,
    profile?.voiceCloneId,
    profile?.voiceCloneName,
    profile?.ageRange,
    profile?.gender,
    profile?.ethnicity,
    profile?.nationality,
    profile?.autoGenerateImages,
    profile?.defaultAspectRatio,
  ]);

  useEffect(() => {
    if (searchParams?.get('purchase') === 'credits') {
      setCreditsModalOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('purchase');
      router.replace(`/account${params.size ? `?${params}` : ''}`);
    } else if (searchParams?.get('purchase') === 'success') {
      // Get stored sessionId and verify payment
      const storedSessionId = sessionStorage.getItem('pendingStripeSessionId');
      const storedUserId = sessionStorage.getItem('pendingStripeUserId');

      console.log('[AccountPage] Purchase success detected', {
        hasSessionId: !!storedSessionId,
        hasUserId: !!storedUserId,
        currentUserId: user?.uid,
        sessionId: storedSessionId,
      });

      // Clean up stored values
      sessionStorage.removeItem('pendingStripeSessionId');
      sessionStorage.removeItem('pendingStripeUserId');

      // Refresh profile first to get current credits
      void refreshProfile().then(async () => {
        const previousCredits = profile?.credits ?? 0;
        console.log('[AccountPage] Previous credits:', previousCredits);

        // If we have a sessionId, verify payment and add credits if needed
        if (storedSessionId && storedUserId && user?.uid === storedUserId) {
          console.log(
            '[AccountPage] Verifying payment with sessionId:',
            storedSessionId
          );
          try {
            const verifyRes = await fetch('/api/stripe/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: storedSessionId,
                userId: storedUserId,
              }),
            });

            const verifyData = await verifyRes.json();
            console.log('[AccountPage] Verify payment response:', {
              ok: verifyRes.ok,
              status: verifyRes.status,
              data: verifyData,
            });

            if (verifyRes.ok) {
              if (verifyData.success && !verifyData.alreadyProcessed) {
                // Credits were just added via fallback
                console.log(
                  '[AccountPage] Credits added via verify-payment endpoint:',
                  verifyData.creditsAdded
                );
                await refreshProfile();
                toast({
                  title: 'Payment successful!',
                  description: `Your ${verifyData.creditsAdded} aiams have been added. Thank you!`,
                });
              } else if (verifyData.alreadyProcessed) {
                // Already processed (webhook worked)
                console.log('[AccountPage] Payment already processed');
                await refreshProfile();
                toast({
                  title: 'Payment successful!',
                  description: 'Your aiams have been added. Thank you!',
                });
              } else {
                // Verification failed but payment was successful
                console.warn(
                  '[AccountPage] Verification returned unexpected result:',
                  verifyData
                );
                await refreshProfile();
                toast({
                  title: 'Payment successful',
                  description:
                    "Your aiams should be added shortly. If they don't appear, please refresh the page.",
                });
              }
            } else {
              // Verification failed, but still show success message
              console.error('[AccountPage] Verify payment failed:', verifyData);
              await refreshProfile();
              toast({
                title: 'Payment successful',
                description: `Verification failed: ${
                  verifyData.error || 'Unknown error'
                }. Please contact support if credits don't appear.`,
                variant: 'destructive',
              });
            }
          } catch (error) {
            console.error('[AccountPage] Payment verification failed', error);
            await refreshProfile();
            toast({
              title: 'Payment successful',
              description:
                "Error verifying payment. Please contact support if credits don't appear.",
              variant: 'destructive',
            });
          }
        } else {
          // No sessionId stored, just refresh and show success
          console.warn('[AccountPage] No sessionId found in sessionStorage', {
            storedSessionId,
            storedUserId,
            currentUserId: user?.uid,
          });
          await refreshProfile();
          toast({
            title: 'Payment successful',
            description:
              'Session data not found. Please refresh the page to see your updated credits.',
          });
        }
      });

      const params = new URLSearchParams(searchParams.toString());
      params.delete('purchase');
      router.replace(`/account${params.size ? `?${params}` : ''}`);
    } else if (searchParams?.get('purchase') === 'cancel') {
      // Clean up stored session data
      sessionStorage.removeItem('pendingStripeSessionId');
      sessionStorage.removeItem('pendingStripeUserId');

      toast({
        title: 'Payment cancelled',
        description: 'No charges were made. You can try again anytime.',
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete('purchase');
      router.replace(`/account${params.size ? `?${params}` : ''}`);
    }
    if (searchParams?.get('setup') === 'images') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('setup');
      router.replace(`/account${params.size ? `?${params}` : ''}`);
      setTimeout(() => {
        referenceSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 200);
    }
  }, [router, searchParams, toast, refreshProfile]);

  useEffect(() => {
    return () => {
      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
      }
    };
  }, [voicePreviewUrl]);

  const isDirty = useMemo(() => {
    return (
      displayName.trim() !== (profile?.displayName ?? '') ||
      photoPreview !== (profile?.photoURL ?? null) ||
      portraitPreview !== (profile?.portraitImageUrl ?? null) ||
      fullBodyPreview !== (profile?.fullBodyImageUrl ?? null) ||
      ageRange !== (profile?.ageRange ?? undefined) ||
      gender !== (profile?.gender ?? undefined) ||
      ethnicity !== (profile?.ethnicity ?? undefined) ||
      nationality.trim() !== (profile?.nationality ?? '') ||
      defaultAspectRatio !== (profile?.defaultAspectRatio ?? '1:1')
    );
  }, [
    displayName,
    photoPreview,
    portraitPreview,
    fullBodyPreview,
    ageRange,
    gender,
    ethnicity,
    nationality,
    defaultAspectRatio,
    profile?.displayName,
    profile?.photoURL,
    profile?.portraitImageUrl,
    profile?.fullBodyImageUrl,
    profile?.ageRange,
    profile?.gender,
    profile?.ethnicity,
    profile?.nationality,
    profile?.autoGenerateImages,
  ]);

  const uploadToStorage = async (
    file: File,
    path: string,
    setPreview: (value: string) => void,
    setUploading: (value: boolean) => void
  ) => {
    setUploading(true);
    try {
      const extension = file.type.split('/')[1] ?? 'jpg';
      const storageRef = ref(firebaseStorage, `${path}.${extension}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setPreview(downloadUrl);
      toast({
        title: 'Image uploaded',
        description: 'Preview updated. Save your profile to keep the change.',
      });
    } catch (error) {
      console.error('[AccountPage] Failed to upload image', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Please try another image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) {
      toast({
        title: 'You need an account',
        description: 'Log in to personalize your profile image.',
        variant: 'destructive',
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    await uploadToStorage(
      file,
      `users/${user.uid}/profile/avatar`,
      setPhotoPreview,
      setUploadingAvatar
    );
  };

  const handlePortraitSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user || !profile) {
      toast({
        title: 'You need an account',
        description: 'Log in to personalize your profile image.',
        variant: 'destructive',
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    await uploadToStorage(
      file,
      `users/${user.uid}/profile/portrait`,
      setPortraitPreview,
      setUploadingPortrait
    );
  };

  const handleFullBodySelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user || !profile) {
      toast({
        title: 'You need an account',
        description: 'Log in to personalize your profile image.',
        variant: 'destructive',
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    await uploadToStorage(
      file,
      `users/${user.uid}/profile/full-body`,
      setFullBodyPreview,
      setUploadingFullBody
    );
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) {
      toast({
        title: 'You need an account',
        description: 'Log in to update your profile details.',
        variant: 'destructive',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const trimmedName = displayName.trim();
      if (!trimmedName) {
        throw new Error('Please enter a display name.');
      }

      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, {
          displayName: trimmedName,
          photoURL: photoPreview ?? undefined,
        });
      }

      const userDoc = doc(firebaseDb, 'users', user.uid);
      await updateDoc(userDoc, {
        displayName: trimmedName,
        photoURL: photoPreview ?? null,
        portraitImageUrl: portraitPreview ?? null,
        fullBodyImageUrl: fullBodyPreview ?? null,
        ageRange: ageRange ?? null,
        gender: gender ?? null,
        ethnicity: ethnicity ?? null,
        nationality: nationality.trim() ? nationality.trim() : null,
        defaultAspectRatio: defaultAspectRatio,
      });

      await refreshProfile();
      toast({
        title: 'Profile updated',
        description: 'Your AiAm profile has been refreshed.',
      });
    } catch (error) {
      console.error('[AccountPage] Failed to save profile', error);
      toast({
        title: 'Unable to update profile',
        description:
          error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const openCreditsModal = (tierId?: string) => {
    setSelectedTier(tierId ?? null);
    setCreditsModalOpen(true);
  };

  const handleSaveAutoGenerate = async () => {
    if (!user || !profile) {
      toast({
        title: 'You need an account',
        description: 'Log in to update your preferences.',
        variant: 'destructive',
      });
      return;
    }

    setSavingAutoGenerate(true);
    try {
      const userDoc = doc(firebaseDb, 'users', user.uid);
      await updateDoc(userDoc, {
        autoGenerateImages: autoGenerateImagesPref,
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      setAutoGenerateConfirmOpen(false);
      toast({
        title: 'Preference saved',
        description: autoGenerateImagesPref
          ? 'Images will now be generated automatically with each affirmation.'
          : 'Images will no longer be generated automatically. You can generate them manually when needed.',
      });
    } catch (error) {
      console.error(
        '[AccountPage] Failed to save auto-generate preference',
        error
      );
      toast({
        title: 'Unable to save preference',
        description: 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setSavingAutoGenerate(false);
    }
  };

  const handleAutoGenerateToggle = (checked: boolean) => {
    setAutoGenerateImagesPref(checked);
    // Show confirmation dialog
    setAutoGenerateConfirmOpen(true);
  };

  const handlePurchase = async (packId: string) => {
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to purchase aiams.',
        variant: 'destructive',
      });
      return;
    }

    if (!publishableKey) {
      toast({
        title: 'Stripe not configured',
        description:
          'Payment processing is not available. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your environment variables.',
        variant: 'destructive',
      });
      return;
    }

    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    if (!pack) return;

    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, userId: user.uid }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Unable to start checkout.');
      }

      const { url, sessionId } = await res.json();

      if (!url) {
        throw new Error('No checkout URL received from server.');
      }

      // Store sessionId to verify payment on return
      if (sessionId) {
        sessionStorage.setItem('pendingStripeSessionId', sessionId);
        sessionStorage.setItem('pendingStripeUserId', user.uid);
        console.log('[AccountPage] Stored sessionId for verification:', {
          sessionId,
          userId: user.uid,
        });
      } else {
        console.warn('[AccountPage] No sessionId received from server');
      }

      // Use standard redirect instead of deprecated redirectToCheckout
      window.location.href = url;
    } catch (error) {
      console.error('[AccountPage] Stripe checkout failed', error);
      toast({
        title: 'Checkout failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, {
          type: 'audio/webm',
        });
        setVoicePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (error) {
      console.error('[AccountPage] Unable to access microphone', error);
      toast({
        title: 'Microphone access denied',
        description:
          'Please allow microphone access to record your voice or upload an audio file instead.',
        variant: 'destructive',
      });
    }
  };

  const handleVoiceUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size < 30000) {
      toast({
        title: 'Audio too short',
        description: 'Please upload at least 30 seconds of clear speech.',
        variant: 'destructive',
      });
      return;
    }
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHasNewVoiceFile(true);
  };

  const resetVoicePreview = () => {
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
    }
    setVoicePreviewUrl(null);
    setHasNewVoiceFile(false);
  };

  const uploadVoiceClone = async () => {
    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description: 'Log in to set up your personal voice.',
        variant: 'destructive',
      });
      return;
    }

    let blob: Blob | null = null;
    if (voicePreviewUrl) {
      const response = await fetch(voicePreviewUrl);
      blob = await response.blob();
    }

    if (!blob) {
      toast({
        title: 'Provide a voice sample',
        description: 'Upload or record at least 30 seconds of your voice.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingVoice(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice-sample.webm');
      formData.append(
        'name',
        profile?.displayName
          ? `${profile.displayName} - AiAm Voice`
          : 'AiAm Voice Clone'
      );

      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.detail ?? data?.error ?? 'Failed to clone voice.'
        );
      }

      if (!data?.voiceId) {
        throw new Error('Voice clone ID was not returned.');
      }

      const userDoc = doc(firebaseDb, 'users', user.uid);
      await updateDoc(userDoc, {
        voiceCloneId: data.voiceId,
        voiceCloneName: data.voiceName ?? null,
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      setVoiceCloneId(data.voiceId);
      setVoiceCloneName(data.voiceName ?? null);
      resetVoicePreview();
      setHasNewVoiceFile(false);
      toast({
        title: 'Voice cloned successfully',
        description: 'Your AiAm affirmations can now speak in your voice.',
      });
    } catch (error) {
      console.error('[AccountPage] Voice cloning failed', error);
      toast({
        title: 'Voice cloning failed',
        description:
          error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setUploadingVoice(false);
    }
  };

  const removeVoiceClone = async () => {
    if (!user) return;
    try {
      const userDoc = doc(firebaseDb, 'users', user.uid);
      await updateDoc(userDoc, {
        voiceCloneId: null,
        voiceCloneName: null,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setVoiceCloneId(null);
      setVoiceCloneName(null);
      setHasNewVoiceFile(false);
      toast({
        title: 'Voice clone removed',
        description: 'You can upload a new sample whenever you are ready.',
      });
    } catch (error) {
      console.error('[AccountPage] Failed to remove voice clone', error);
      toast({
        title: 'Unable to remove voice clone',
        description:
          error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'destructive',
      });
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <main className='container mx-auto max-w-3xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Show sign-in prompt only if user is definitely not authenticated
  if (!user || !profile) {
    return (
      <main className='container mx-auto max-w-3xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Sign in to access your AiAm account settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant='outline' onClick={() => router.push('/')}>
              Go to home
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <main className='container mx-auto max-w-4xl px-6 py-0 pb-8 space-y-8'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-3xl font-semibold'>Account settings</h1>
          <p className='text-muted-foreground'>
            Update your personal details, manage credits, and customize your
            AiAm experience.
          </p>
        </div>

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]'>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                This information is displayed with your affirmations and saved
                items.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex flex-col gap-4 md:flex-row'>
                <div className='relative h-32 w-32 overflow-hidden rounded-2xl border bg-muted'>
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt={profile.displayName ?? 'Profile'}
                      fill
                      className='object-cover'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground'>
                      {profile.displayName?.charAt(0) ??
                        profile.email?.charAt(0) ??
                        'A'}
                    </div>
                  )}
                </div>
                <div className='flex flex-1 flex-col gap-3'>
                  <div>
                    <Label htmlFor='display-name'>Display name</Label>
                    <Input
                      id='display-name'
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder='Your name'
                    />
                  </div>
                  <div>
                    <Label htmlFor='email'>Email</Label>
                    <Input
                      id='email'
                      value={profile.email ?? ''}
                      disabled
                      readOnly
                    />
                  </div>

                  <div className='flex flex-wrap gap-3'>
                    <Button
                      variant='outline'
                      className='flex items-center gap-2'
                      disabled={uploadingAvatar}
                      onClick={() =>
                        document.getElementById('avatar-upload')?.click()
                      }
                    >
                      {uploadingAvatar ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <UploadCloud className='h-4 w-4' />
                      )}
                      Upload photo
                    </Button>
                    <input
                      id='avatar-upload'
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleAvatarSelected}
                    />
                    <Button
                      onClick={handleSaveProfile}
                      disabled={!isDirty || savingProfile}
                      className='flex items-center gap-2'
                    >
                      {savingProfile ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Wand2 className='h-4 w-4' />
                      )}
                      Save changes
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image preferences</CardTitle>
              <CardDescription>
                Share a little about yourself so AiAm can better match imagery
                before you upload personal reference photos.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='age-range'>Age range</Label>
                  <Select
                    value={ageRange ?? 'none'}
                    onValueChange={(value) =>
                      setAgeRange(value === 'none' ? undefined : value)
                    }
                  >
                    <SelectTrigger id='age-range'>
                      <SelectValue placeholder='Select age range' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No preference</SelectItem>
                      {AGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='gender'>Sex</Label>
                  <Select
                    value={gender ?? 'none'}
                    onValueChange={(value) =>
                      setGender(value === 'none' ? undefined : value)
                    }
                  >
                    <SelectTrigger id='gender'>
                      <SelectValue placeholder='Select sex' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No preference</SelectItem>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ethnicity'>Ethnicity</Label>
                  <Select
                    value={ethnicity ?? 'none'}
                    onValueChange={(value) =>
                      setEthnicity(value === 'none' ? undefined : value)
                    }
                  >
                    <SelectTrigger id='ethnicity'>
                      <SelectValue placeholder='Select ethnicity' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>No preference</SelectItem>
                      {ETHNICITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='nationality'>Nationality</Label>
                  <Input
                    id='nationality'
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                    placeholder='e.g., United States'
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='aspect-ratio'>Default image aspect ratio</Label>
                <Select
                  value={defaultAspectRatio}
                  onValueChange={setDefaultAspectRatio}
                >
                  <SelectTrigger id='aspect-ratio'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='1:1'>Square (1:1)</SelectItem>
                    <SelectItem value='16:9'>Widescreen (16:9)</SelectItem>
                    <SelectItem value='9:16'>Portrait (9:16)</SelectItem>
                    <SelectItem value='4:3'>Standard (4:3)</SelectItem>
                    <SelectItem value='3:4'>Vertical (3:4)</SelectItem>
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  This ratio will be used for all new image generations.
                </p>
              </div>
              <div className='flex items-center justify-between gap-4 rounded-2xl bg-muted/30 px-4 py-3'>
                <div className='flex-1'>
                  <p className='text-sm font-medium text-foreground'>
                    Generate images automatically
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    AiAm will pair each affirmation with artwork unless you turn
                    this off.
                  </p>
                </div>
                <div className='flex items-center gap-3'>
                  <Switch
                    id='auto-generate-images'
                    checked={autoGenerateImagesPref}
                    onCheckedChange={handleAutoGenerateToggle}
                  />
                  {autoGenerateImagesPref !==
                    (profile?.autoGenerateImages ?? true) && (
                    <Button
                      size='sm'
                      onClick={handleSaveAutoGenerate}
                      disabled={savingAutoGenerate}
                    >
                      {savingAutoGenerate ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card ref={referenceSectionRef}>
            <CardHeader>
              <CardTitle>Personal reference images</CardTitle>
              <CardDescription>
                Upload two clear images so AiAm can reference your likeness in
                future generations. Aim for natural lighting and neutral
                backgrounds. Personal image generation adds +10 aiams per
                affirmation.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* <div className='grid gap-6 md:grid-cols-2 bg-green-200 flex items center justify-center px-auto'> */}
              <div className='gap-20 flex items-center justify-center'>
                <div className='space-y-3'>
                  <Label htmlFor='portrait-upload'>Close-up / headshot</Label>
                  <div className='relative h-48 w-48 overflow-hidden rounded-2xl border bg-muted'>
                    {portraitPreview ? (
                      <Image
                        src={portraitPreview}
                        alt='Portrait reference'
                        fill
                        className='object-cover'
                      />
                    ) : (
                      <div className='px-3 flex h-full items-center justify-center text-sm text-center text-muted-foreground'>
                        Upload a clear photo of your face and shoulders.
                      </div>
                    )}
                  </div>
                  <div className='flex items-center gap-3'>
                    <Button
                      variant='outline'
                      className='flex items-center gap-2'
                      disabled={uploadingPortrait}
                      onClick={() =>
                        document.getElementById('portrait-upload')?.click()
                      }
                    >
                      {uploadingPortrait ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <UploadCloud className='h-4 w-4' />
                      )}
                      Upload portrait
                    </Button>
                    <input
                      id='portrait-upload'
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handlePortraitSelected}
                    />
                  </div>
                </div>
                <div className='space-y-3'>
                  <Label htmlFor='full-body-upload'>Full-body photograph</Label>
                  <div className='relative h-48 w-48 overflow-hidden rounded-2xl border bg-muted'>
                    {fullBodyPreview ? (
                      <Image
                        src={fullBodyPreview}
                        alt='Full body reference'
                        fill
                        className='object-cover'
                      />
                    ) : (
                      <div className='px-3 flex h-full items-center justify-center text-sm text-center text-muted-foreground'>
                        Upload a full-body image showing your posture and outfit
                        style.
                      </div>
                    )}
                  </div>
                  <div className='flex items-center gap-3'>
                    <Button
                      variant='outline'
                      className='flex items-center gap-2'
                      disabled={uploadingFullBody}
                      onClick={() =>
                        document.getElementById('full-body-upload')?.click()
                      }
                    >
                      {uploadingFullBody ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <UploadCloud className='h-4 w-4' />
                      )}
                      Upload full body
                    </Button>
                    <input
                      id='full-body-upload'
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleFullBodySelected}
                    />
                  </div>
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  variant='default'
                  onClick={handleSaveProfile}
                  disabled={!isDirty || savingProfile}
                  className='flex items-center gap-2'
                >
                  {savingProfile ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Wand2 className='h-4 w-4' />
                  )}
                  Save reference images
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                AiAm stores these privately for your account. You can update or
                remove them at any time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aiams</CardTitle>
              <CardDescription>
                Purchase aiams to create personalized affirmations with your
                image and voice.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-baseline gap-3'>
                <span className='text-4xl font-semibold'>
                  {profile.credits ?? 0}
                </span>
                <span className='text-muted-foreground'>aiams</span>
              </div>
              <Button
                className='w-full cursor-pointer'
                onClick={() => openCreditsModal()}
              >
                Add aiams
              </Button>
              <Collapsible className='space-y-2'>
                <CollapsibleTrigger asChild>
                  <Button
                    variant='ghost'
                    className='w-full justify-between text-sm'
                  >
                    <span>How credits work</span>
                    <ChevronDown className='h-4 w-4' />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className='space-y-2 text-sm text-muted-foreground'>
                  <div className='space-y-2 rounded-lg border bg-muted/30 p-3'>
                    <p className='font-medium text-foreground'>Base costs:</p>
                    <ul className='list-disc list-inside space-y-1 ml-2'>
                      <li>
                        Basic affirmation (generic image, AI voice):{' '}
                        <span className='font-semibold text-foreground'>
                          {BASE_AFFIRMATION_COST} aiams
                        </span>
                      </li>
                      <li>
                        + Personal image:{' '}
                        <span className='font-semibold text-foreground'>
                          +{PERSONAL_IMAGE_COST} aiams
                        </span>
                      </li>
                      <li>
                        + Voice clone playback:{' '}
                        <span className='font-semibold text-foreground'>
                          +{VOICE_CLONE_COST} aiams
                        </span>
                      </li>
                    </ul>
                    <p className='pt-2 text-xs'>
                      Total cost ranges from {BASE_AFFIRMATION_COST} to{' '}
                      {BASE_AFFIRMATION_COST +
                        PERSONAL_IMAGE_COST +
                        VOICE_CLONE_COST}{' '}
                      aiams per affirmation, depending on features used.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </section>

        {/* <section>
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Voice, imagery, and playlist settings will appear here as we
                expand AiAm.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                We’re building tools to let you fine-tune how AiAm speaks,
                looks, and delivers your affirmations. Stay tuned for updates!
              </p>
            </CardContent>
          </Card>
        </section> */}

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Voice personalization</CardTitle>
              <CardDescription>
                Record or upload at least 30 seconds of clear speech so AiAm can
                read your affirmations in your own voice. Voice clone playback
                adds +20 aiams per affirmation.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2 rounded-2xl border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground'>
                <p>
                  Tips:
                  <br />• Speak naturally with steady pacing and minimal
                  background noise.
                  <br />• Reading 3–4 affirmation statements aloud usually hits
                  the 30-second minimum.
                  <br />• You can upload multiple samples over time to improve
                  accuracy.
                </p>
              </div>

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  variant={recording ? 'destructive' : 'secondary'}
                  className='flex items-center gap-2'
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? (
                    <StopCircle className='h-4 w-4' />
                  ) : (
                    <Mic className='h-4 w-4' />
                  )}
                  {recording ? 'Stop recording' : 'Record voice sample'}
                </Button>
                <Button
                  variant='outline'
                  className='flex items-center gap-2'
                  onClick={() =>
                    document.getElementById('voice-upload')?.click()
                  }
                >
                  <UploadCloud className='h-4 w-4' />
                  Upload audio (30s+)
                </Button>
                <input
                  id='voice-upload'
                  type='file'
                  accept='audio/*'
                  className='hidden'
                  onChange={handleVoiceUpload}
                />
                {voicePreviewUrl && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='flex items-center gap-2 text-destructive'
                    onClick={resetVoicePreview}
                  >
                    <Trash2 className='h-4 w-4' />
                    Clear sample
                  </Button>
                )}
              </div>

              {voicePreviewUrl && (
                <div className='space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-4'>
                  <p className='text-sm font-medium'>Preview recording</p>
                  <audio controls src={voicePreviewUrl} className='w-full' />
                </div>
              )}

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  variant='default'
                  disabled={
                    uploadingVoice || !!(voiceCloneId && !hasNewVoiceFile)
                  }
                  onClick={uploadVoiceClone}
                  className='flex items-center gap-2'
                  title={
                    voiceCloneId && !hasNewVoiceFile
                      ? 'Upload a new voice sample to replace the current one'
                      : 'Save your voice sample'
                  }
                >
                  {uploadingVoice ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Wand2 className='h-4 w-4' />
                  )}
                  Save personal voice
                </Button>
                {voiceCloneId && (
                  <div className='flex items-center gap-3 text-sm text-muted-foreground'>
                    <span>
                      Current voice clone:{' '}
                      <strong>{voiceCloneName ?? voiceCloneId}</strong>
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-destructive'
                      onClick={removeVoiceClone}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Dialog open={creditsModalOpen} onOpenChange={setCreditsModalOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Select a credit pack</DialogTitle>
            <DialogDescription>
              Choose the bundle that matches your affirmation practice.
              Purchasing is coming soon—preview the tiers below.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {CREDIT_PACKS.map((pack) => (
              <Card
                key={pack.id}
                className={`border ${
                  selectedTier === pack.id ? 'border-primary' : ''
                }`}
              >
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <div>
                      <CardTitle className='text-lg'>{pack.title}</CardTitle>
                      <CardDescription>{pack.description}</CardDescription>
                      <p className='text-xs text-muted-foreground mt-1'>
                        {pack.costPer100} per 100 aiams
                      </p>
                    </div>
                    <span className='text-base font-semibold'>
                      {pack.price}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <Button
                    variant='secondary'
                    onClick={() => {
                      setSelectedTier(pack.id);
                      handlePurchase(pack.id);
                    }}
                  >
                    Choose
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />
          <p className='text-xs text-muted-foreground'>
            Payments are not enabled yet. We’ll notify you when credit purchases
            are live.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={autoGenerateConfirmOpen}
        onOpenChange={setAutoGenerateConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save auto-generate preference?</DialogTitle>
            <DialogDescription>
              {autoGenerateImagesPref
                ? 'Images will be automatically generated with each new affirmation. This will use your personal reference images if available.'
                : 'Images will no longer be generated automatically. You can generate them manually when needed.'}
            </DialogDescription>
          </DialogHeader>
          <div className='flex justify-end gap-3 mt-4'>
            <Button
              variant='outline'
              onClick={() => {
                setAutoGenerateConfirmOpen(false);
                // Revert toggle if cancelled
                setAutoGenerateImagesPref(profile?.autoGenerateImages ?? true);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAutoGenerate}
              disabled={savingAutoGenerate}
            >
              {savingAutoGenerate ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
