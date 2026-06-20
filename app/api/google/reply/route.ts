import { supabaseAdmin } from "@/lib/supabase-admin";

const supabase = supabaseAdmin;

async function refreshGoogleAccessToken(connection: any) {
  if (!connection.refresh_token) {
    return {
      accessToken: connection.access_token,
      error: "Missing refresh token",
    };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      accessToken: connection.access_token,
      error: data,
    };
  }

  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  await supabase
    .from("google_connections")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
    })
    .eq("id", connection.id);

  return {
    accessToken: data.access_token,
    error: null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId;
    const reviewName = body.reviewName;
    const comment = body.comment;

    if (!userId || !reviewName || !comment) {
      return Response.json(
        { error: "Missing userId, reviewName, or comment" },
        { status: 400 }
      );
    }

    const { data: connections } = await supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1);

    const connection = connections?.[0];

    if (!connection) {
      return Response.json(
        { error: "Google not connected" },
        { status: 400 }
      );
    }
    const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!subscription) {
    return Response.json(
      {
        status: 403,
        statusText: "No subscription found",
        error: "No subscription found for this user.",
      },
      { status: 403 }
    );
  }
  
  if (subscription.reviews_used >= subscription.review_limit) {
    return Response.json(
      {
        status: 403,
        statusText: "Reply limit reached",
        error: `You have reached your monthly limit of ${subscription.review_limit} posted replies. Please upgrade your plan.`,
      },
      { status: 403 }
    );
  }
    const refreshed = await refreshGoogleAccessToken(connection);

    if (refreshed.error) {
      return Response.json(
        {
          error: "Could not refresh Google token",
          details: refreshed.error,
        },
        { status: 401 }
      );
    }

    const googleResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment,
        }),
      }
    );

    const text = await googleResponse.text();

    if (googleResponse.ok) {
        await supabase
          .from("subscriptions")
          .update({
            reviews_used: subscription.reviews_used + 1,
          })
          .eq("user_id", userId);
      }
      
      return Response.json({
        status: googleResponse.status,
        statusText: googleResponse.statusText,
        ok: googleResponse.ok,
        raw: text,
      });
  } catch (error) {
    return Response.json(
      {
        error: "Server error posting Google reply",
        details: String(error),
      },
      { status: 500 }
    );
  }
}