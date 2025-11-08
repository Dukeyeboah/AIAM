'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
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
  createdAt?: Date;
  updatedAt?: Date;
}

interface UseUserAffirmationsOptions {
  favoritesOnly?: boolean;
  categoryId?: string | null;
}

export function useUserAffirmations(options: UseUserAffirmationsOptions = {}) {
  const { user } = useAuth();
  const [affirmations, setAffirmations] = useState<UserAffirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { favoritesOnly = false, categoryId = null } = options;

  useEffect(() => {
    if (!user) {
      setAffirmations([]);
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

    const clauses = [];
    if (favoritesOnly) {
      clauses.push(where('favorite', '==', true));
    }
    if (categoryId) {
      clauses.push(where('categoryId', '==', categoryId));
    }

    const affirmationsQuery =
      clauses.length > 0
        ? query(baseCollection, ...clauses, orderBy('createdAt', 'desc'))
        : query(baseCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      affirmationsQuery,
      (snapshot) => {
        const nextAffirmations = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as DocumentData;
          return {
            id: docSnapshot.id,
            affirmation: (data.affirmation as string) ?? '',
            categoryId: (data.categoryId as string) ?? '',
            categoryTitle: (data.categoryTitle as string) ?? '',
            imageUrl: (data.imageUrl as string | null) ?? null,
            favorite: Boolean(data.favorite),
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          } satisfies UserAffirmation;
        });
        setAffirmations(nextAffirmations);
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
  }, [categoryId, favoritesOnly, user]);

  const categories = useMemo(() => {
    const uniques = new Map<string, string>();
    affirmations.forEach((item) => {
      if (item.categoryId) {
        uniques.set(item.categoryId, item.categoryTitle);
      }
    });
    return Array.from(uniques.entries()).map(([id, title]) => ({
      id,
      title,
    }));
  }, [affirmations]);

  return {
    affirmations,
    categories,
    loading,
    error,
  };
}
