import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");
    const accountName = searchParams.get("accountName");

    if (!userId) {
      return Response.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    if (!accountName) {
      return Response.json(
        { error: "Missing accountName" },
        { status: 400 }
      );
    }

    const { data: connections, error } = await supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const connection = connections?.[0];

    if (!connection) {
      return Response.json(
        { error: "Google not connected" },
        { status: 400 }
      );
    }

    const allLocations = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({
        readMask: "name,title,storefrontAddress,metadata",
        pageSize: "100",
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const googleResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params.toString()}`,
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
            error: "Google locations API error",
            status: googleResponse.status,
            details: googleData,
          },
          { status: googleResponse.status }
        );
      }

      allLocations.push(...(googleData.locations || []));
      pageToken = googleData.nextPageToken || "";
    } while (pageToken);

    return Response.json({
      count: allLocations.length,
      locations: allLocations,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Server error fetching Google locations" },
      { status: 500 }
    );
  }
}