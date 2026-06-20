import { supabaseAdmin } from "@/lib/supabase-admin";

const supabase = supabaseAdmin;

function ratingToNumber(starRating: string | undefined) {
  if (starRating === "ONE") return 1;
  if (starRating === "TWO") return 2;
  if (starRating === "THREE") return 3;
  if (starRating === "FOUR") return 4;
  if (starRating === "FIVE") return 5;
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId;
    const locationId = body.locationId;

    if (!userId || !locationId) {
      return Response.json(
        { error: "Missing userId or locationId" },
        { status: 400 }
      );
    }

    const { data: connectionRows } = await supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1);

    const connection = connectionRows?.[0];

    if (!connection) {
      return Response.json(
        { error: "Google not connected" },
        { status: 400 }
      );
    }

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .eq("user_id", userId)
      .single();

    if (locationError || !location) {
      return Response.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    if (!location.google_location_name) {
      return Response.json(
        { error: "This location is missing google_location_name" },
        { status: 400 }
      );
    }

    const allReviews: any[] = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({
        pageSize: "50",
        orderBy: "updateTime desc",
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const googleResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/-/${location.google_location_name}/reviews?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
          },
        }
      );

      const googleData = await googleResponse.json();

      if (!googleResponse.ok) {
        return Response.json(
          {
            error: "Google reviews import error",
            status: googleResponse.status,
            details: googleData,
          },
          { status: googleResponse.status }
        );
      }

      allReviews.push(...(googleData.reviews || []));
      pageToken = googleData.nextPageToken || "";
    } while (pageToken);

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const item of allReviews) {
      const reviewText = item.comment || "";
      const googleReviewName = item.name;

      if (!googleReviewName) continue;

      const reviewReply = item.reviewReply?.comment || null;

      const payload = {
        user_id: userId,
        location_id: Number(locationId),
        platform: "google",
        reviewer_name: item.reviewer?.displayName || null,
        rating: ratingToNumber(item.starRating),
        review_text: reviewText,
        ai_response: reviewReply || "",
        google_review_name: googleReviewName,
        review_reply: reviewReply,
        google_create_time: item.createTime || null,
        google_update_time: item.updateTime || null,
      };

      const { data: existingRows } = await supabase
        .from("reviews")
        .select("id")
        .eq("google_review_name", googleReviewName)
        .limit(1);

      const existing = existingRows?.[0];

      if (existing) {
        const { error } = await supabase
          .from("reviews")
          .update(payload)
          .eq("id", existing.id);

        if (error) errors.push(error.message);
        else updated++;
      } else {
        const { error } = await supabase.from("reviews").insert(payload);

        if (error) errors.push(error.message);
        else inserted++;
      }
    }

    return Response.json({
      success: errors.length === 0,
      location: location.name,
      fetched: allReviews.length,
      inserted,
      updated,
      errors,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Server error importing reviews",
        details: String(error),
      },
      { status: 500 }
    );
  }
}