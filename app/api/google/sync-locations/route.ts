import { supabaseAdmin } from "@/lib/supabase-admin";

const supabase = supabaseAdmin;

export async function GET(req: Request) {
  try {
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

    const accountsResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    const accountsData = await accountsResponse.json();
    const account = accountsData.accounts?.[0];

    if (!account) {
      return Response.json({ error: "No Google account found" }, { status: 400 });
    }

    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    const locationsData = await locationsResponse.json();
    const googleLocations = locationsData.locations || [];

    const currentGoogleLocationNames = googleLocations
  .map((location: any) => location.name)
  .filter(Boolean);

if (currentGoogleLocationNames.length > 0) {
  await supabase
    .from("locations")
    .delete()
    .eq("user_id", userId)
    .eq("platform", "google")
    .not("google_location_name", "in", `(${currentGoogleLocationNames.map((name: string) => `"${name}"`).join(",")})`);
}
    const savedLocations = [];
    const errors = [];

    for (const location of googleLocations) {
      const addressLines = location.storefrontAddress?.addressLines || [];
      const city = location.storefrontAddress?.locality || "";
      const state = location.storefrontAddress?.administrativeArea || "";
      const zip = location.storefrontAddress?.postalCode || "";

      const address = [...addressLines, city, state, zip]
        .filter(Boolean)
        .join(", ");

      const googlePlaceId = location.metadata?.placeId;

      const { data: existingRows, error: existingError } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", userId)
        .eq("google_place_id", googlePlaceId)
        .order("id", { ascending: true });

      if (existingError) {
        errors.push(existingError.message);
        continue;
      }

      const existing = existingRows?.[0];

      if (existing) {
        const { data, error } = await supabase
          .from("locations")
          .update({
            name: location.title,
            address,
            platform: "google",
            google_location_name: location.name,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) errors.push(error.message);
        if (data) savedLocations.push(data);

        const duplicateRows = existingRows.slice(1);

        for (const duplicate of duplicateRows) {
          await supabase
            .from("locations")
            .delete()
            .eq("id", duplicate.id);
        }
      } else {
        const { data, error } = await supabase
          .from("locations")
          .insert({
            user_id: userId,
            name: location.title,
            address,
            platform: "google",
            google_place_id: googlePlaceId,
            google_location_name: location.name,
          })
          .select()
          .single();

        if (error) errors.push(error.message);
        if (data) savedLocations.push(data);
      }
    }

    return Response.json({
      success: errors.length === 0,
      googleCount: googleLocations.length,
      savedCount: savedLocations.length,
      savedLocations,
      errors,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to sync locations" },
      { status: 500 }
    );
  }
}