import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = supabaseAdmin;

function buildPrompt({
  businessInfo,
  replyInstructions,
  tone,
  review,
}: {
  businessInfo: string;
  replyInstructions: string;
  tone: string;
  review: string;
}) {
  return `
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

Customer review:
${review}
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId;
    const locationId = body.locationId;
    const tone = body.tone || "professional";
    const businessInfo = body.businessInfo || "";
    const replyInstructions = body.replyInstructions || "";
    const limit = Math.min(Number(body.limit || 10), 10);

    if (!userId || !locationId) {
      return Response.json(
        { error: "Missing userId or locationId" },
        { status: 400 }
      );
    }

    const { data: pendingReviews, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("location_id", locationId)
      .is("review_reply", null)
      .or("posted_to_google.is.null,posted_to_google.eq.false")
      .or("ai_response.is.null,ai_response.eq.")
      .order("id", { ascending: false })
      .limit(limit);

    if (error) {
      return Response.json(
        { error: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!pendingReviews || pendingReviews.length === 0) {
      return Response.json({
        success: true,
        generated: 0,
        message: "No pending reviews need AI replies.",
      });
    }

    let generated = 0;
    const errors: string[] = [];

    for (const item of pendingReviews) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "user",
              content: buildPrompt({
                businessInfo,
                replyInstructions,
                tone,
                review: item.review_text || "",
              }),
            },
          ],
        });

        const aiResponse =
          completion.choices[0].message.content || "";

        const { error: updateError } = await supabase
          .from("reviews")
          .update({
            ai_response: aiResponse,
          })
          .eq("id", item.id)
          .eq("user_id", userId);

        if (updateError) {
          errors.push(updateError.message);
        } else {
          generated++;
        }
      } catch (err) {
        errors.push(String(err));
      }
    }

    return Response.json({
      success: errors.length === 0,
      requested: pendingReviews.length,
      generated,
      errors,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Server error generating bulk replies",
        details: String(error),
      },
      { status: 500 }
    );
  }
}