export async function POST(request: Request) {
  try {
    const { affirmation } = await request.json()

    // Create a prompt for image generation based on the affirmation
    const imagePrompt = `Create a calming, abstract, inspirational image that represents: "${affirmation}". 
    Style: soft colors, peaceful, minimalist, uplifting, serene atmosphere, paper texture aesthetic.`

    // Use placeholder for now - in production, you'd integrate with an image generation API
    // like fal.ai, Replicate, or OpenAI DALL-E
    const imageUrl = `/placeholder.svg?height=512&width=512&query=${encodeURIComponent(imagePrompt)}`

    return Response.json({ imageUrl })
  } catch (error) {
    console.error("[v0] Error in generate-image:", error)
    return Response.json({ error: "Failed to generate image" }, { status: 500 })
  }
}
