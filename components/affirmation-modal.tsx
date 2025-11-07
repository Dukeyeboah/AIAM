"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Category } from "./category-grid"
import { RefreshCw, Volume2, Bookmark, ImageIcon, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AffirmationModalProps {
  category: Category | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AffirmationModal({ category, open, onOpenChange }: AffirmationModalProps) {
  const [affirmation, setAffirmation] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const { toast } = useToast()

  const generateAffirmation = async () => {
    if (!category) return

    setIsGenerating(true)
    setGeneratedImage(null)

    try {
      const response = await fetch("/api/generate-affirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category.title }),
      })

      const data = await response.json()
      setAffirmation(data.affirmation)
    } catch (error) {
      console.error("[v0] Error generating affirmation:", error)
      toast({
        title: "Error",
        description: "Failed to generate affirmation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateImage = async () => {
    if (!affirmation) return

    setIsGeneratingImage(true)

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affirmation }),
      })

      const data = await response.json()
      setGeneratedImage(data.imageUrl)
    } catch (error) {
      console.error("[v0] Error generating image:", error)
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const speakAffirmation = () => {
    if (!affirmation) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    if (isSpeaking) {
      setIsSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(affirmation)
    utterance.rate = 0.8 // Slower, calmer pace
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  const bookmarkAffirmation = () => {
    if (!affirmation || !category) return

    const bookmarks = JSON.parse(localStorage.getItem("affirmations") || "[]")
    const newBookmark = {
      id: Date.now(),
      category: category.title,
      affirmation,
      image: generatedImage,
      createdAt: new Date().toISOString(),
    }

    bookmarks.push(newBookmark)
    localStorage.setItem("affirmations", JSON.stringify(bookmarks))

    toast({
      title: "Bookmarked!",
      description: "Affirmation saved to your collection.",
    })
  }

  useEffect(() => {
    if (open && category) {
      generateAffirmation()
    } else {
      // Clean up speech when modal closes
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setGeneratedImage(null)
    }
  }, [open, category])

  if (!category) return null

  const Icon = category.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br",
                category.gradient,
              )}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            {category.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Affirmation Text */}
          <div className="relative">
            {isGenerating ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <blockquote className="text-xl md:text-2xl font-medium text-center text-balance leading-relaxed text-foreground px-4 py-8 bg-muted/30 rounded-2xl">
                "{affirmation}"
              </blockquote>
            )}
          </div>

          {/* Generated Image */}
          {generatedImage && (
            <div className="rounded-2xl overflow-hidden">
              <img
                src={generatedImage || "/placeholder.svg"}
                alt="Affirmation visualization"
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={generateAffirmation}
              disabled={isGenerating}
              className="gap-2 bg-transparent"
            >
              <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
              Regenerate
            </Button>

            <Button
              variant="outline"
              onClick={speakAffirmation}
              disabled={isGenerating || !affirmation}
              className="gap-2 bg-transparent"
            >
              <Volume2 className={cn("w-4 h-4", isSpeaking && "animate-pulse")} />
              {isSpeaking ? "Stop" : "Play"}
            </Button>

            <Button
              variant="outline"
              onClick={generateImage}
              disabled={isGenerating || isGeneratingImage || !affirmation}
              className="gap-2 bg-transparent"
            >
              <ImageIcon className={cn("w-4 h-4", isGeneratingImage && "animate-pulse")} />
              {isGeneratingImage ? "Generating..." : "Generate Image"}
            </Button>

            <Button
              variant="outline"
              onClick={bookmarkAffirmation}
              disabled={isGenerating || !affirmation}
              className="gap-2 bg-transparent"
            >
              <Bookmark className="w-4 h-4" />
              Bookmark
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
