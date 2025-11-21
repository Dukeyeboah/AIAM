'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';

import { useAuth } from '@/providers/auth-provider';
import { firebaseDb } from '@/lib/firebase/client';

export interface UserAffirmation {
  id: string;
  affirmation: string;
  categoryId: string;
  categoryTitle: string;
  imageUrl: string | null;
  favorite: boolean;
  useMyVoice?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  audioUrls?: Record<string, string>;
}

interface UseUserAffirmationsOptions {
  favoritesOnly?: boolean;
  categoryId?: string | null;
}

export function useUserAffirmations(options: UseUserAffirmationsOptions = {}) {
  const { user } = useAuth();
  const [rawAffirmations, setRawAffirmations] = useState<UserAffirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { favoritesOnly = false, categoryId = null } = options;

  useEffect(() => {
    if (!user) {
      setRawAffirmations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const baseCollection = collection(
      firebaseDb,
      'users',
      user.uid,
      'affirmations'
    );

    const affirmationsQuery = query(
      baseCollection,
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      affirmationsQuery,
      (snapshot) => {
        const nextAffirmations = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as DocumentData;
          const audioUrlsRaw = data.audioUrls;
          const audioUrls =
            audioUrlsRaw && typeof audioUrlsRaw === 'object'
              ? Object.entries(audioUrlsRaw).reduce<Record<string, string>>(
                  (acc, [key, value]) => {
                    if (typeof value === 'string') {
                      acc[key] = value;
                    }
                    return acc;
                  },
                  {}
                )
              : {};
          return {
            id: docSnapshot.id,
            affirmation: (data.affirmation as string) ?? '',
            categoryId: (data.categoryId as string) ?? '',
            categoryTitle: (data.categoryTitle as string) ?? '',
            imageUrl: (data.imageUrl as string | null) ?? null,
            favorite: Boolean(data.favorite),
            useMyVoice: Boolean(data.useMyVoice),
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
            audioUrls,
          } satisfies UserAffirmation;
        });
        setRawAffirmations(nextAffirmations);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          '[useUserAffirmations] Failed to load data',
          snapshotError
        );
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : 'Failed to load affirmations.'
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const categories = useMemo(() => {
    const uniques = new Map<string, string>();
    rawAffirmations.forEach((item) => {
      if (item.categoryId) {
        uniques.set(item.categoryId, item.categoryTitle);
      }
    });
    return Array.from(uniques.entries()).map(([id, title]) => ({
      id,
      title,
    }));
  }, [rawAffirmations]);

  const affirmations = useMemo(() => {
    return rawAffirmations.filter((item) => {
      if (favoritesOnly && !item.favorite) {
        return false;
      }
      if (categoryId && item.categoryId !== categoryId) {
        return false;
      }
      return true;
    });
  }, [categoryId, favoritesOnly, rawAffirmations]);

  return {
    affirmations,
    categories,
    loading,
    error,
  };
}
