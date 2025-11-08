'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';

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
import { useUserAffirmations } from '@/hooks/use-user-affirmations';
import { useAuth } from '@/providers/auth-provider';

export default function SavedPage() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    'all'
  );
  const { affirmations, categories, loading } = useUserAffirmations({
    favoritesOnly: true,
    categoryId: selectedCategory === 'all' ? null : selectedCategory,
  });

  const total = useMemo(() => affirmations.length, [affirmations.length]);

  if (!user) {
    return (
      <main className='container mx-auto max-w-4xl px-6 py-12'>
        <Card>
          <CardHeader>
            <CardTitle>Saved affirmations</CardTitle>
            <CardDescription>
              Sign in to revisit the affirmations you’ve marked as favorites.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className='container mx-auto max-w-5xl px-6 py-12 space-y-8'>
      <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold'>Saved affirmations</h1>
          <p className='text-muted-foreground'>
            Every affirmation you’ve favorited lives here. Filter by category,
            revisit images, and keep your inspiration close.
          </p>
        </div>
        <Select
          value={selectedCategory}
          onValueChange={(value) =>
            setSelectedCategory(value as string | 'all')
          }
        >
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='Filter category' />
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
      </div>

      <Card>
        <CardHeader className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <CardTitle>Favorites</CardTitle>
            <CardDescription>
              {total > 0
                ? `You’ve saved ${total} affirmation${total === 1 ? '' : 's'}.`
                : 'Tap the heart icon inside the generator to save affirmations here.'}
            </CardDescription>
          </div>
          <Button variant='outline' onClick={() => setSelectedCategory('all')}>
            Clear filters
          </Button>
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
              <HeartPulse className='h-10 w-10 text-muted-foreground' />
              <div>
                <h3 className='text-lg font-medium'>
                  No saved affirmations yet
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Mark affirmations as favorites to build your collection.
                </p>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {affirmations.map((item) => (
                <Card key={item.id} className='overflow-hidden'>
                  <CardHeader className='space-y-3'>
                    <Badge variant='secondary'>{item.categoryTitle}</Badge>
                    <CardTitle className='text-base font-medium'>
                      {item.affirmation}
                    </CardTitle>
                  </CardHeader>
                  {item.imageUrl ? (
                    <div className='relative h-44 w-full'>
                      <Image
                        src={item.imageUrl}
                        alt='Saved affirmation'
                        fill
                        className='object-cover'
                      />
                    </div>
                  ) : (
                    <div className='flex h-44 items-center justify-center bg-muted text-sm text-muted-foreground'>
                      Image not available
                    </div>
                  )}
                  <CardContent className='space-y-2 text-xs text-muted-foreground'>
                    <p>
                      Saved:{' '}
                      {item.updatedAt
                        ? item.updatedAt.toLocaleString()
                        : 'recently'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
