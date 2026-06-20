import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId;
    const plan = body.plan;

    if (!userId) {
      return Response.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    let priceId = "";

    if (plan === "starter") {
      priceId = process.env.STRIPE_STARTER_PRICE_ID!;
    }

    if (plan === "pro") {
      priceId = process.env.STRIPE_PRO_PRICE_ID!;
    }

    if (!priceId) {
      return Response.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
    });

    return Response.json({
      url: session.url,
    });
  } catch (error) {
    console.log(error);

    return Response.json(
      { error: "Could not create checkout session" },
      { status: 500 }
    );
  }
}