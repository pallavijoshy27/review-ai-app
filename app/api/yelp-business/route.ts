export async function GET(req: Request) {
    try {
      const { searchParams } = new URL(req.url);
  
      const term = searchParams.get("term");
      const location = searchParams.get("location");
  
      if (!term || !location) {
        return Response.json(
          { error: "Missing term or location" },
          { status: 400 }
        );
      }
  
      const response = await fetch(
        `https://api.yelp.com/v3/businesses/search?term=${term}&location=${location}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.YELP_API_KEY}`,
          },
        }
      );
  
      const data = await response.json();
  
      return Response.json(data);
    } catch (error) {
      console.error(error);
  
      return Response.json(
        { error: "Server error" },
        { status: 500 }
      );
    }
  }