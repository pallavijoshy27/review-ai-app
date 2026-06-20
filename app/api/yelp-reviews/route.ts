import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.yelp.com/v3/businesses/${businessId}/reviews?locale=en_US`,
      {
        headers: {
          Authorization: `Bearer ${process.env.YELP_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    console.log("Yelp Reviews Response:", data);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.description ||
            "Failed to fetch Yelp reviews",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      reviews: data.reviews || [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error fetching Yelp reviews" },
      { status: 500 }
    );
  }
}