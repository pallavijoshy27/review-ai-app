import OpenAI from "openai";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const review = body.review;
    const tone = body.tone;
    const businessInfo = body.businessInfo;
    const userId = body.userId;

    if (!review) {
      return Response.json(
        { error: "Review is required." },
        { status: 400 }
      );
    }

    if (!userId) {
      return Response.json(
        { error: "User is required." },
        { status: 400 }
      );
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

    const aiResponse =
      completion.choices[0].message.content || "";

    const { error } = await supabase
      .from("reviews")
      .insert({
        review_text: review,
        ai_response: aiResponse,
        user_id: userId,
      });

    if (error) {
      return Response.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return Response.json({
      response: aiResponse,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Server error. Check terminal for details." },
      { status: 500 }
    );
  }
}