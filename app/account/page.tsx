'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UploadCloud, Wand2 } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
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

const CREDIT_TIERS = [
  {
    id: 'starter',
    title: 'Starter',
    description: '500 credits',
    price: '$4.99',
  },
  {
    id: 'creator',
    title: 'Creator',
    description: '1,200 credits',
    price: '$9.99',
  },
  {
    id: 'visionary',
    title: 'Visionary',
    description: '2,500 credits',
    price: '$18.99',
  },
  {
    id: 'luminary',
    title: 'Luminary',
    description: '5,500 credits',
    price: '$34.99',
  },
];

export default function AccountPage() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    }
    if (profile?.photoURL) {
      setPhotoPreview(profile.photoURL);
    }
  }, [profile?.displayName, profile?.photoURL]);

  useEffect(() => {
    if (searchParams?.get('purchase') === 'credits') {
      setCreditsModalOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('purchase');
      router.replace(`/account${params.size ? `?${params}` : ''}`);
    }
  }, [router, searchParams]);

  const isDirty = useMemo(() => {
    return (
      displayName.trim() !== (profile?.displayName ?? '') ||
      photoPreview !== (profile?.photoURL ?? null)
    );
  }, [displayName, photoPreview, profile?.displayName, profile?.photoURL]);

  const handleSaveProfile = async () => {
    if (!user) {
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
      });

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

  const handleImageSelected = async (
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

    setUploadingImage(true);
    try {
      const storageRef = ref(
        firebaseStorage,
        `users/${user.uid}/profile/avatar.${file.type.split('/')[1] ?? 'jpg'}`
      );
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setPhotoPreview(downloadUrl);
      toast({
        title: 'Image uploaded',
        description: 'Preview updated. Save your profile to keep the change.',
      });
    } catch (error) {
      console.error('[AccountPage] Failed to upload avatar', error);
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Please try another image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const openCreditsModal = (tierId?: string) => {
    setSelectedTier(tierId ?? null);
    setCreditsModalOpen(true);
  };

  const handlePurchase = (tierId: string) => {
    const tier = CREDIT_TIERS.find((item) => item.id === tierId);
    if (!tier) return;

    toast({
      title: `Purchase ${tier.title}`,
      description: 'Payment integration is coming soon.',
    });
  };

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
                      disabled={uploadingImage}
                      onClick={() =>
                        document.getElementById('avatar-upload')?.click()
                      }
                    >
                      {uploadingImage ? (
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
                      onChange={handleImageSelected}
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
              <CardTitle>Credits</CardTitle>
              <CardDescription>
                You start with 100 free credits. Purchase more to unlock
                additional affirmations and imagery.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-baseline gap-3'>
                <span className='text-4xl font-semibold'>
                  {profile.credits}
                </span>
                <span className='text-muted-foreground'>credits</span>
              </div>
              <Button className='w-full' onClick={() => openCreditsModal()}>
                Add credits
              </Button>
              <p className='text-xs text-muted-foreground'>
                Credits power affirmation generations, saved playlists, and
                premium experiences. More options coming soon.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
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
            {CREDIT_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className={`border ${
                  selectedTier === tier.id ? 'border-primary' : ''
                }`}
              >
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <div>
                      <CardTitle className='text-lg'>{tier.title}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                    </div>
                    <span className='text-base font-semibold'>
                      {tier.price}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <Button
                    variant='secondary'
                    onClick={() => {
                      setSelectedTier(tier.id);
                      handlePurchase(tier.id);
                    }}
                  >
                    Choose
                  </Button>
                  <Button
                    variant='ghost'
                    onClick={() => setSelectedTier(tier.id)}
                  >
                    Learn more
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
    </>
  );
}
