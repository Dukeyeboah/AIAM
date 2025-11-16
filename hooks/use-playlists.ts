'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';

import { useAuth } from '@/providers/auth-provider';
import { firebaseDb } from '@/lib/firebase/client';

export interface Playlist {
  id: string;
  name: string;
  affirmationIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export function usePlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const playlistsCollection = collection(
      firebaseDb,
      'users',
      user.uid,
      'playlists'
    );

    const playlistsQuery = query(
      playlistsCollection,
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      playlistsQuery,
      (snapshot) => {
        const nextPlaylists = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as DocumentData;
          return {
            id: docSnapshot.id,
            name: (data.name as string) ?? '',
            affirmationIds: (data.affirmationIds as string[]) ?? [],
            createdAt: data.createdAt?.toDate?.() ?? undefined,
            updatedAt: data.updatedAt?.toDate?.() ?? undefined,
          } satisfies Playlist;
        });
        setPlaylists(nextPlaylists);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[use-playlists] Error fetching playlists', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  return { playlists, loading, error };
}
