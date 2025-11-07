import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { category } = await request.json()

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Generate a single, powerful, positive affirmation for the category: "${category}". 
      
      The affirmation should be:
      - In first person ("I am", "I have", "I create", etc.)
      - Present tense
      - Positive and empowering
      - Specific to the category
      - Between 15-30 words
      - Inspiring and uplifting
      
      Return ONLY the affirmation text, without quotes or extra formatting.`,
    })

    return Response.json({ affirmation: text.trim() })
  } catch (error) {
    console.error("[v0] Error in generate-affirmation:", error)
    return Response.json({ error: "Failed to generate affirmation" }, { status: 500 })
  }
}
