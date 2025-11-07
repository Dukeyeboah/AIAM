"use client"

import type React from "react"

import { useState } from "react"
import { CategoryCard } from "./category-card"
import { AffirmationModal } from "./affirmation-modal"
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
} from "lucide-react"

export interface Category {
  id: string
  title: string
  icon: React.ElementType
  gradient: string
}

const categories: Category[] = [
  {
    id: "housing-home",
    title: "Housing & Home",
    icon: Home,
    gradient: "from-blue-400 to-cyan-400",
  },
  {
    id: "finance-wealth",
    title: "Finance & Wealth",
    icon: DollarSign,
    gradient: "from-emerald-400 to-teal-400",
  },
  {
    id: "health-wellbeing",
    title: "Health & Wellbeing",
    icon: Heart,
    gradient: "from-rose-400 to-pink-400",
  },
  {
    id: "travel-adventure",
    title: "Travel & Adventure",
    icon: Plane,
    gradient: "from-amber-400 to-orange-400",
  },
  {
    id: "relationships-love",
    title: "Relationships & Love",
    icon: Users,
    gradient: "from-purple-400 to-pink-400",
  },
  {
    id: "creativity-expression",
    title: "Creativity & Expression",
    icon: Palette,
    gradient: "from-violet-400 to-purple-400",
  },
  {
    id: "career-employment",
    title: "Career & Employment",
    icon: Briefcase,
    gradient: "from-indigo-400 to-blue-400",
  },
  {
    id: "education-knowledge",
    title: "Education & Knowledge",
    icon: BookOpen,
    gradient: "from-cyan-400 to-blue-400",
  },
  {
    id: "spirituality-peace",
    title: "Spirituality & Inner Peace",
    icon: Sparkles,
    gradient: "from-teal-400 to-emerald-400",
  },
  {
    id: "personal-growth",
    title: "Personal Growth & Development",
    icon: TrendingUp,
    gradient: "from-green-400 to-emerald-400",
  },
  {
    id: "self-confidence",
    title: "Self-Confidence & Empowerment",
    icon: Shield,
    gradient: "from-yellow-400 to-amber-400",
  },
  {
    id: "joy-happiness",
    title: "Joy & Happiness",
    icon: Smile,
    gradient: "from-orange-400 to-rose-400",
  },
]

export function CategoryGrid() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => setSelectedCategory(category)}
            delay={index * 0.05}
          />
        ))}
      </div>

      <AffirmationModal
        category={selectedCategory}
        open={!!selectedCategory}
        onOpenChange={(open) => !open && setSelectedCategory(null)}
      />
    </>
  )
}
