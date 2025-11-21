'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import {
  firebaseAuth,
  firebaseDb,
  googleAuthProvider,
} from '@/lib/firebase/client';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  portraitImageUrl?: string | null;
  fullBodyImageUrl?: string | null;
  voiceCloneId?: string | null;
  voiceCloneName?: string | null;
  ageRange?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  nationality?: string | null;
  autoGenerateImages?: boolean;
  defaultAspectRatio?: string | null;
  useMyVoiceByDefault?: boolean;
  tier?: string | null;
  credits: number;
  savedCount: number;
}

interface SignUpWithEmailInput {
  email: string;
  password: string;
  firstName?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  authLoading: boolean;
  signUpWithEmail: (input: SignUpWithEmailInput) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  provider: GoogleAuthProvider;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEFAULT_CREDITS = 100;

const mapFirebaseError = (error: unknown): Error => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return new Error('An account with this email already exists.');
      case 'auth/invalid-email':
        return new Error('Please enter a valid email address.');
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
        return new Error('We could not find an account for that email.');
      case 'auth/wrong-password':
        return new Error('The password you entered is incorrect.');
      case 'auth/weak-password':
        return new Error('Choose a password with at least 6 characters.');
      case 'auth/popup-closed-by-user':
        return new Error(
          'The Google sign-in flow was cancelled. Please try again.'
        );
      default:
        return new Error(
          error.message || 'Authentication failed. Please try again.'
        );
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Something went wrong. Please try again.');
};

const ensureUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
  const userRef = doc(firebaseDb, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  const baseDisplayName =
    firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Friend';

  const baseProfile: UserProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? null,
    displayName: baseDisplayName,
    photoURL: firebaseUser.photoURL ?? null,
    portraitImageUrl: null,
    fullBodyImageUrl: null,
    voiceCloneId: null,
    voiceCloneName: null,
    ageRange: null,
    gender: null,
    ethnicity: null,
    nationality: null,
    autoGenerateImages: true,
    defaultAspectRatio: '1:1',
    useMyVoiceByDefault: false,
    tier: null,
    credits: DEFAULT_CREDITS,
    savedCount: 0,
  };

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...baseProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return baseProfile;
  }

  const data = snapshot.data() as DocumentData;
  const mergedProfile: UserProfile = {
    ...baseProfile,
    displayName:
      (data.displayName as string | undefined) ?? baseProfile.displayName,
    photoURL:
      (data.photoURL as string | undefined) ?? firebaseUser.photoURL ?? null,
    portraitImageUrl: (data.portraitImageUrl as string | undefined) ?? null,
    fullBodyImageUrl: (data.fullBodyImageUrl as string | undefined) ?? null,
    voiceCloneId: (data.voiceCloneId as string | undefined) ?? null,
    voiceCloneName: (data.voiceCloneName as string | undefined) ?? null,
    ageRange: (data.ageRange as string | undefined) ?? null,
    gender: (data.gender as string | undefined) ?? null,
    ethnicity: (data.ethnicity as string | undefined) ?? null,
    nationality: (data.nationality as string | undefined) ?? null,
    autoGenerateImages:
      typeof data.autoGenerateImages === 'boolean'
        ? data.autoGenerateImages
        : true,
    defaultAspectRatio:
      (data.defaultAspectRatio as string | undefined) ?? '1:1',
    useMyVoiceByDefault:
      typeof data.useMyVoiceByDefault === 'boolean'
        ? data.useMyVoiceByDefault
        : false,
    credits: typeof data.credits === 'number' ? data.credits : DEFAULT_CREDITS,
    savedCount: typeof data.savedCount === 'number' ? data.savedCount : 0,
  };

  const needsUpdate =
    mergedProfile.displayName !== data.displayName ||
    mergedProfile.photoURL !== data.photoURL ||
    mergedProfile.portraitImageUrl !== data.portraitImageUrl ||
    mergedProfile.fullBodyImageUrl !== data.fullBodyImageUrl ||
    mergedProfile.voiceCloneId !== data.voiceCloneId ||
    mergedProfile.voiceCloneName !== data.voiceCloneName ||
    mergedProfile.ageRange !== (data.ageRange as string | undefined) ||
    mergedProfile.gender !== (data.gender as string | undefined) ||
    mergedProfile.ethnicity !== (data.ethnicity as string | undefined) ||
    mergedProfile.nationality !== (data.nationality as string | undefined) ||
    mergedProfile.autoGenerateImages !== data.autoGenerateImages ||
    mergedProfile.defaultAspectRatio !==
      (data.defaultAspectRatio as string | undefined) ||
    mergedProfile.useMyVoiceByDefault !==
      (typeof data.useMyVoiceByDefault === 'boolean'
        ? data.useMyVoiceByDefault
        : false) ||
    mergedProfile.tier !== (data.tier as string | undefined) ||
    typeof data.credits !== 'number' ||
    typeof data.savedCount !== 'number';

  if (needsUpdate) {
    await updateDoc(userRef, {
      displayName: mergedProfile.displayName,
      photoURL: mergedProfile.photoURL,
      portraitImageUrl: mergedProfile.portraitImageUrl ?? null,
      fullBodyImageUrl: mergedProfile.fullBodyImageUrl ?? null,
      voiceCloneId: mergedProfile.voiceCloneId ?? null,
      voiceCloneName: mergedProfile.voiceCloneName ?? null,
      ageRange: mergedProfile.ageRange ?? null,
      gender: mergedProfile.gender ?? null,
      ethnicity: mergedProfile.ethnicity ?? null,
      nationality: mergedProfile.nationality ?? null,
      autoGenerateImages: mergedProfile.autoGenerateImages ?? true,
      defaultAspectRatio: mergedProfile.defaultAspectRatio ?? '1:1',
      useMyVoiceByDefault: mergedProfile.useMyVoiceByDefault ?? false,
      tier: mergedProfile.tier ?? null,
      credits: mergedProfile.credits,
      savedCount: mergedProfile.savedCount,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      updatedAt: serverTimestamp(),
    });
  }

  return mergedProfile;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            const resolvedProfile = await ensureUserProfile(firebaseUser);
            setProfile(resolvedProfile);
          } catch (profileError) {
            console.error('[auth] Failed to load user profile', profileError);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        setInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signUpWithEmail = useCallback(
    async ({ email, password, firstName }: SignUpWithEmailInput) => {
      setAuthLoading(true);
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );

        if (firstName) {
          await updateProfile(credential.user, {
            displayName: firstName.trim(),
          });
        }

        await ensureUserProfile(credential.user);
      } catch (error) {
        throw mapFirebaseError(error);
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setAuthLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        );
        await ensureUserProfile(credential.user);
      } catch (error) {
        throw mapFirebaseError(error);
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      const credential = await signInWithPopup(
        firebaseAuth,
        googleAuthProvider
      );
      await ensureUserProfile(credential.user);
    } catch (error) {
      throw mapFirebaseError(error);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = firebaseAuth.currentUser;
    if (!current) {
      return;
    }
    try {
      await current.reload();
      const reloaded = firebaseAuth.currentUser;
      if (reloaded) {
        setUser(reloaded);
        const resolvedProfile = await ensureUserProfile(reloaded);
        setProfile(resolvedProfile);
      }
    } catch (error) {
      console.error('[auth] Failed to refresh profile', error);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initializing,
      authLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      refreshProfile,
      provider: googleAuthProvider,
    }),
    [
      user,
      profile,
      initializing,
      authLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
