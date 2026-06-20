import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data: connections } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1);

  const connection = connections?.[0];

  if (!connection) {
    return Response.json({ error: "Google not connected" }, { status: 400 });
  }

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    }
  );

  const data = await response.json();

  return Response.json(data);
}