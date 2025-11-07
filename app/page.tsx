import { CategoryGrid } from "@/components/category-grid"
import { BackgroundAnimation } from "@/components/background-animation"

export default function Home() {
  return (
    <main className="relative min-h-screen paper-texture overflow-hidden">
      <BackgroundAnimation />

      <div className="relative z-10 container mx-auto px-4 py-12">
        <header className="text-center mb-12 space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-balance bg-gradient-to-br from-primary via-accent to-secondary bg-clip-text text-transparent">
            Affirmaition
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Discover personalized affirmations to nurture your mind, body, and soul
          </p>
        </header>

        <CategoryGrid />
      </div>
    </main>
  )
}
