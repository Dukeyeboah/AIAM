"use client"

import { Card } from "@/components/ui/card"
import type { Category } from "./category-grid"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: Category
  onClick: () => void
  delay?: number
}

export function CategoryCard({ category, onClick, delay = 0 }: CategoryCardProps) {
  const Icon = category.icon

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-300",
        "hover:scale-105 hover:shadow-xl",
        "animate-float",
      )}
      style={{
        animationDelay: `${delay}s`,
      }}
      onClick={onClick}
    >
      <div className="p-6 space-y-4">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            "bg-gradient-to-br transition-transform duration-300",
            "group-hover:scale-110",
            category.gradient,
          )}
        >
          <Icon className="w-7 h-7 text-white" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-card-foreground text-balance">{category.title}</h3>
        </div>
      </div>

      {/* Subtle hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  )
}
