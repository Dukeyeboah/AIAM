'use client';

import type React from 'react';

import { useState } from 'react';
import { CategoryCard } from './category-card';
import { AffirmationModal } from './affirmation-modal';
import {
  Home,
  DollarSign,
  Heart,
  Plane,
  Users,
  Palette,
  Briefcase,
  BookOpen,
  Sparkles,
  TrendingUp,
  Shield,
  Smile,
} from 'lucide-react';

export interface Category {
  id: string;
  title: string;
  icon: React.ElementType;
  gradient: {
    from: string;
    to: string;
  };
}

export const categories: Category[] = [
  {
    id: 'housing-home',
    title: 'Housing & Home',
    icon: Home,
    gradient: {
      from: 'hsla(400, 100%, 86%, 0.78)',
      to: 'hsla(688, 100%, 85%, 0.72)',
    },
  },
  {
    id: 'finance-wealth',
    title: 'Finance & Wealth',
    icon: DollarSign,
    gradient: {
      from: 'hsla(888, 68%, 82%, 0.78)',
      to: 'hsla(774, 72%, 80%, 0.72)',
    },
  },
  {
    id: 'health-wellbeing',
    title: 'Health & Wellbeing',
    icon: Heart,
    gradient: {
      from: 'hsla(900, 88%, 86%, 0.78)',
      to: 'hsla(970, 70%, 95%, 0.72)',
    },
  },
  {
    id: 'travel-adventure',
    title: 'Travel & Adventure',
    icon: Plane,
    gradient: {
      from: 'hsla(60, 100%, 85%, 0.78)',
      to: 'hsla(2, 100%, 83%, 0.72)',
    },
  },
  {
    id: 'relationships-love',
    title: 'Relationships & Love',
    icon: Users,
    gradient: {
      from: 'hsla(888, 88%, 86%, 0.78)',
      to: 'hsla(700, 84%, 86%, 0.72)',
    },
  },
  {
    id: 'creativity-expression',
    title: 'Creativity & Expression',
    icon: Palette,
    gradient: {
      from: 'hsla(752, 82%, 86%, 0.78)',
      to: 'hsla(69, 76%, 85%, 0.72)',
    },
  },
  {
    id: 'career-employment',
    title: 'Career & Employment',
    icon: Briefcase,
    gradient: {
      from: 'hsla(671, 84%, 86%, 0.78)',
      to: 'hsla(88, 100%, 85%, 0.72)',
    },
  },
  {
    id: 'education-knowledge',
    title: 'Education & Knowledge',
    icon: BookOpen,
    gradient: {
      from: 'hsla(206, 88%, 86%, 0.78)',
      to: 'hsla(499, 100%, 82%, 0.72)',
    },
  },
  {
    id: 'spirituality-peace',
    title: 'Spirituality & Inner Peace',
    icon: Sparkles,
    gradient: {
      from: 'hsla(688, 90%, 84%, 0.78)',
      to: 'hsla(180, 76%, 82%, 0.72)',
    },
  },
  {
    id: 'personal-growth',
    title: 'Personal Growth & Development',
    icon: TrendingUp,
    gradient: {
      from: 'hsla(60, 90%, 82%, 0.78)',
      to: 'hsla(180, 76%, 80%, 0.72)',
    },
  },
  {
    id: 'self-confidence',
    title: 'Self-Confidence & Empowerment',
    icon: Shield,
    gradient: {
      from: 'hsla(60, 100%, 86%, 0.78)',
      to: 'hsla(340, 90%, 85%, 0.72)',
    },
  },
  {
    id: 'joy-happiness',
    title: 'Joy & Happiness',
    icon: Smile,
    gradient: {
      from: 'hsla(124, 100%, 85%, 0.78)',
      to: 'hsla(340, 99%, 86%, 0.72)',
    },
  },
];

export function CategoryGrid() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedCategory =
    selectedIndex !== null ? categories[selectedIndex] : null;
  const isModalOpen = selectedIndex !== null;

  const handleNavigate = (direction: number) => {
    if (selectedIndex === null) {
      return;
    }

    const total = categories.length;
    const nextIndex = (selectedIndex + direction + total) % total;
    setSelectedIndex(nextIndex);
  };

  return (
    <>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6'>
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => setSelectedIndex(index)}
            delay={index * 0.35}
            duration={6 + (index % 4) * 0.45}
          />
        ))}
      </div>

      <AffirmationModal
        categories={categories}
        currentIndex={selectedIndex}
        category={selectedCategory}
        open={isModalOpen}
        onNavigate={handleNavigate}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIndex(null);
          }
        }}
      />
    </>
  );
}
