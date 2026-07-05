import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = supabaseAdmin;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const review = body.review;
    const tone = body.tone || "professional";
    const businessInfo = body.businessInfo || "";
    const userId = body.userId;
    const locationId = body.locationId;
    const reviewId = body.reviewId;

    if (!review) {
      return Response.json({ error: "Review is required." }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: "User is required." }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are responding on behalf of this business:

${businessInfo}

The tone style should be: ${tone}

Rules:
Important reply rules:
- Do not use the same opening phrase repeatedly across replies.
- Avoid overusing phrases like "Thank you so much for your kind words", "We're thrilled to hear", "We're delighted", or "We appreciate your feedback."
- Vary the opening sentence naturally.
- If the review has no written text and is only a 5-star rating, write a very short appreciation reply only.
- For a 5-star rating with no written text, keep the reply to 1 sentence.
- Do not invent details the customer did not mention.
- Keep replies warm, natural, and concise.
- Do not use the same opening phrase repeatedly.
- Avoid overusing phrases like "Thank you so much for your kind words", "We're thrilled to hear", or "We appreciate your feedback."
- Vary the opening sentence naturally.
- If the review has no written text and is only a 5-star rating, write a very short appreciation reply only.
- For a 5-star rating with no text, examples of appropriate replies are:
  "Thank you for the 5-star rating. We truly appreciate your support."
  "Thank you for the wonderful rating. We appreciate you choosing us."
  "We appreciate the 5-star rating. Thank you for your support."
- Do not invent details that the customer did not mention.
- Keep replies natural, specific when possible, and not overly long.
- Keep responses under 4 sentences
- Never sound robotic
- Never use placeholders
- Match the emotional tone of the review
- Sound natural and human
- If the review is positive, thank them warmly
- If the review is negative, apologize professionally and invite them to return or contact the business
`,
        },
        {
          role: "user",
          content: `Write a response to this customer review: ${review}`,
        },
      ],
    });

    const aiResponse = completion.choices[0].message.content || "";

    if (reviewId) {
      const { error } = await supabase
        .from("reviews")
        .update({
          ai_response: aiResponse,
        })
        .eq("id", reviewId)
        .eq("user_id", userId);

      if (error) {
        return Response.json(
          { error: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase.from("reviews").insert({
        review_text: review,
        ai_response: aiResponse,
        user_id: userId,
        location_id: locationId || null,
      });

      if (error) {
        return Response.json(
          { error: `Supabase error: ${error.message}` },
          { status: 500 }
        );
      }
    }

    return Response.json({
      response: aiResponse,
    });
  } catch (error) {
    console.log(error);

    return Response.json(
      { error: "Server error. Check terminal for details." },
      { status: 500 }
    );
  }
}