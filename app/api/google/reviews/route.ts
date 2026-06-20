import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const locationId = searchParams.get("locationId");

    if (!userId) {
      return Response.json({ error: "Missing userId" }, { status: 400 });
    }

    if (!locationId) {
      return Response.json({ error: "Missing locationId" }, { status: 400 });
    }

    const { data: connections, error: connectionError } = await supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1);

    if (connectionError) {
      return Response.json({
        step: "google_connections",
        error: connectionError,
      });
    }

    const connection = connections?.[0];

    if (!connection) {
      return Response.json({ error: "Google not connected" }, { status: 400 });
    }

    const { data: location, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("id", Number(locationId))
      .eq("user_id", userId)
      .single();

    if (locationError) {
      return Response.json({
        step: "location_lookup",
        error: locationError,
      });
    }

    if (!location) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }

    if (!location.google_location_name) {
      return Response.json({
        error: "Location is missing google_location_name",
        location,
      });
    }

    const parent = `accounts/-/${location.google_location_name}`;

    const googleResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50&orderBy=updateTime%20desc`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    const text = await googleResponse.text();

    return Response.json({
      status: googleResponse.status,
      statusText: googleResponse.statusText,
      parent,
      raw: text,
    });
  } catch (error) {
    return Response.json({
      step: "catch",
      error: String(error),
    });
  }
}