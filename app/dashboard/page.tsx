'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { PlusCircle, FolderPlus } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { useUserAffirmations } from '@/hooks/use-user-affirmations';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    'all'
  );
  const { affirmations, categories, loading } = useUserAffirmations({
    categoryId: selectedCategory === 'all' ? null : selectedCategory,
  });
  const { toast } = useToast();

  const playlistsComingSoon = () =>
    toast({
      title: 'Playlists coming soon',
      description:
        'We’re building custom affirmation playlists so you can curate sets for any moment.',
    });

  const greeting = useMemo(() => {
    if (!profile?.displayName) return 'Your dashboard';
    const firstName = profile.displayName.trim().split(/\s+/)[0];
    return `${firstName}'s dashboard`;
  }, [profile?.displayName]);

  if (!user) {
    return (
      <main className='container mx-auto max-w-5xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Sign in to review your affirmations, saved images, and playlists.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-6xl px-6 py-0 pb-8 space-y-8'>
      <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold'>{greeting}</h1>
          <p className='text-muted-foreground'>
            Review everything aiam has generated for you—filter by category,
            spot favorites, and prep playlists.
          </p>
        </div>
        <div className='flex gap-3'>
          <Button
            variant='secondary'
            onClick={playlistsComingSoon}
            className='flex items-center gap-2'
          >
            <FolderPlus className='h-4 w-4' />
            Create playlist
          </Button>
          <Button onClick={() => setSelectedCategory('all')} variant='outline'>
            Clear filters
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>Affirmations</CardTitle>
            <CardDescription>
              {affirmations.length > 0
                ? `Showing ${affirmations.length} affirmation${
                    affirmations.length === 1 ? '' : 's'
                  }.`
                : 'Start generating to see your affirmations here.'}
            </CardDescription>
          </div>
          <Select
            value={selectedCategory}
            onValueChange={(value) =>
              setSelectedCategory(value as string | 'all')
            }
          >
            <SelectTrigger className='w-56'>
              <SelectValue placeholder='Filter by category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className='h-64 rounded-2xl' />
              ))}
            </div>
          ) : affirmations.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-4 py-16 text-center'>
              <PlusCircle className='h-10 w-10 text-muted-foreground' />
              <div>
                <h3 className='text-lg font-medium'>No affirmations yet</h3>
                <p className='text-sm text-muted-foreground'>
                  Generate an affirmation from the home page to start building
                  your collection.
                </p>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {affirmations.map((item) => (
                <AffirmationCard key={item.id} affirmation={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function AffirmationCard({
  affirmation,
}: {
  affirmation: ReturnType<typeof useUserAffirmations>['affirmations'][number];
}) {
  return (
    <Card className='h-full overflow-hidden'>
      <CardHeader className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Badge variant='secondary'>{affirmation.categoryTitle}</Badge>
          {affirmation.favorite && <Badge>Favorite</Badge>}
        </div>
        <CardTitle className='text-base font-medium'>
          {affirmation.affirmation}
        </CardTitle>
      </CardHeader>
      {affirmation.imageUrl ? (
        <div className='relative h-48 w-full'>
          <Image
            src={affirmation.imageUrl}
            alt='Affirmation visualization'
            fill
            className='object-cover'
          />
        </div>
      ) : (
        <div className='flex h-48 items-center justify-center bg-muted text-sm text-muted-foreground'>
          No image saved
        </div>
      )}
      <CardContent className='space-y-2 text-xs text-muted-foreground'>
        <p>
          Created:{' '}
          {affirmation.createdAt
            ? affirmation.createdAt.toLocaleString()
            : 'recently'}
        </p>
        <p>
          Updated:{' '}
          {affirmation.updatedAt
            ? affirmation.updatedAt.toLocaleString()
            : 'just now'}
        </p>
      </CardContent>
    </Card>
  );
}
