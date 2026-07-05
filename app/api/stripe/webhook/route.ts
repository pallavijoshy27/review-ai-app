import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = supabaseAdmin;

function getPlanSettings(plan: string) {
  if (plan === "starter") {
    return { plan: "starter", review_limit: 100 };
  }

  if (plan === "pro") {
    return { plan: "pro", review_limit: 1000 };
  }

  return { plan: "free", review_limit: 5 };
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.log("Stripe webhook signature error:", error);

    return Response.json(
      { error: "Invalid Stripe signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan || "free";

    if (userId) {
      const settings = getPlanSettings(plan);

      await supabase
        .from("subscriptions")
        .update({
          plan: settings.plan,
          status: "active",
          review_limit: settings.review_limit,
          reviews_used: 0,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq("user_id", userId);
    }
  }
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
  
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const cancelAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null;
  
    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_at: cancelAt,
        status: subscription.status,
      })
      .eq("stripe_subscription_id", subscription.id);
  }
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
  
    await supabase
      .from("subscriptions")
      .update({
        plan: "free",
        status: "active",
        review_limit: 5,
        reviews_used: 0,
        stripe_subscription_id: null,
        cancel_at_period_end: false,
        cancel_at: null,
      })
      .eq("stripe_subscription_id", subscription.id);
  }

  return Response.json({ received: true });
}