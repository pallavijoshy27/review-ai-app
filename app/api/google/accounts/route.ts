import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json(
        { error: "Missing userId" },
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

    const googleResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
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
          error: "Google API error",
          status: googleResponse.status,
          details: googleData,
        },
        { status: googleResponse.status }
      );
    }

    return Response.json({
      accounts: googleData.accounts || [],
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Server error fetching Google accounts" },
      { status: 500 }
    );
  }
}