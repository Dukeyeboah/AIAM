'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { firebaseDb } from '@/lib/firebase/client';
import {
  AGE_OPTIONS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
} from '@/lib/demographics';

const STORAGE_KEY = 'aiam-demographics-dismissed';

export function DemographicsOnboardingDialog() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [ageRange, setAgeRange] = useState<string>('none');
  const [gender, setGender] = useState<string>('none');
  const [ethnicity, setEthnicity] = useState<string>('none');
  const [nationality, setNationality] = useState('');
  const [saving, setSaving] = useState(false);

  const missingDemographics = useMemo(() => {
    if (!profile) return false;
    return (
      !profile.ageRange ||
      !profile.gender ||
      !profile.ethnicity ||
      !profile.nationality
    );
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (!missingDemographics) {
      setOpen(false);
      return;
    }

    const snoozed =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (snoozed === 'true') {
      return;
    }

    // Only show demographics dialog after welcome dialog has been seen
    const welcomeSeen =
      typeof window !== 'undefined'
        ? localStorage.getItem('aiam-welcome-dismissed')
        : null;
    if (welcomeSeen !== 'true') {
      // Listen for welcome dialog dismissal
      const handleWelcomeDismissed = () => {
        const checkWelcome =
          typeof window !== 'undefined'
            ? localStorage.getItem('aiam-welcome-dismissed')
            : null;
        if (checkWelcome === 'true' && missingDemographics) {
          setOpen(true);
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('welcome-dismissed', handleWelcomeDismissed);
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener(
            'welcome-dismissed',
            handleWelcomeDismissed
          );
        }
      };
    }

    setOpen(true);
  }, [missingDemographics, profile]);

  useEffect(() => {
    if (!profile) return;
    setAgeRange(profile.ageRange ?? 'none');
    setGender(profile.gender ?? 'none');
    setEthnicity(profile.ethnicity ?? 'none');
    setNationality(profile.nationality ?? '');
  }, [
    profile?.ageRange,
    profile?.gender,
    profile?.ethnicity,
    profile?.nationality,
  ]);

  if (!profile || !user) {
    return null;
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setOpen(false);
  };

  const handleSave = async () => {
    if (
      ageRange === 'none' ||
      gender === 'none' ||
      ethnicity === 'none' ||
      !nationality.trim()
    ) {
      toast({
        title: 'Complete the form',
        description:
          'Please share your age range, sex, ethnicity, and nationality or skip for now.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(firebaseDb, 'users', user.uid), {
        ageRange,
        gender,
        ethnicity,
        nationality: nationality.trim(),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
      setOpen(false);
      toast({
        title: 'Thanks!',
        description:
          'We will use these details to tailor imagery before you add reference photos.',
      });
    } catch (error) {
      console.error('[DemographicsDialog] Failed to save demographics', error);
      toast({
        title: 'Unable to save',
        description:
          error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-lg sm:w-full space-y-6'>
        <DialogHeader>
          <DialogTitle>Help us personalize your imagery</DialogTitle>
          <DialogDescription>
            Share a few quick details so AiAm can better match the visuals we
            generate before you upload personal reference photos.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='onboarding-age'>Age range</Label>
            <Select value={ageRange} onValueChange={setAgeRange}>
              <SelectTrigger id='onboarding-age'>
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
            <Label htmlFor='onboarding-gender'>Sex</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id='onboarding-gender'>
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
          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='onboarding-ethnicity'>Ethnicity</Label>
            <Select value={ethnicity} onValueChange={setEthnicity}>
              <SelectTrigger id='onboarding-ethnicity'>
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
          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='onboarding-nationality'>Nationality</Label>
            <Input
              id='onboarding-nationality'
              value={nationality}
              onChange={(event) => setNationality(event.target.value)}
              placeholder='e.g., United States'
            />
          </div>
        </div>

        <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
          <Button variant='ghost' onClick={handleSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
