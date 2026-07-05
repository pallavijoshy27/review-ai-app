"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Review = {
  id: number;
  review_text: string;
  ai_response: string | null;
  user_id: string | null;
  location_id: number | null;
  platform: string | null;
  reviewer_name: string | null;
  rating: number | null;
  google_review_name: string | null;
  review_reply: string | null;
  posted_to_google: boolean | null;
};

type BusinessProfile = {
  id: number;
  name: string | null;
  business_info: string | null;
  tone: string | null;
  user_id: string | null;
};

type Location = {
  id: number;
  user_id: string | null;
  name: string;
  address: string | null;
  platform: string | null;
  google_place_id: string | null;
  yelp_business_id: string | null;
  google_location_name?: string | null;
};

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkPosting, setBulkPosting] = useState(false);

  const [tone, setTone] = useState("professional");
  const [businessName, setBusinessName] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [manualReview, setManualReview] = useState("");
  const [manualResponse, setManualResponse] = useState("");

const [editingId, setEditingId] = useState<string | number | null>(null);
const [editingReplies, setEditingReplies] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
  "pending" | "replied" | "all"
>("pending");
async function fetchSubscription(currentUserId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (data) setSubscription(data);
}

async function ensureSubscription(currentUserId: string) {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("subscriptions").insert({
      user_id: currentUserId,
      plan: "free",
      status: "active",
      review_limit: 5,
      reviews_used: 0,
    });
  }
}
  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    setLocations([]);
setReviews([]);
setSelectedLocationId(null);
setMessage("");

    setUserId(session.user.id);
    setUserEmail(session.user.email || "");
    setLoadingPage(false);
    await ensureSubscription(session.user.id);
    await fetchSubscription(session.user.id);
    await fetchLocations(session.user.id);
    await fetchBusinessProfile(session.user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function connectGoogle() {
    if (!userId) {
      setMessage("Please log in again before connecting Google.");
      return;
    }
  
    setMessage("Connecting to Google...");
    window.location.href = `/api/google/connect?userId=${userId}`;
  }

  async function syncGoogleLocations() {
    if (!userId) {
      setMessage("Please log in again before syncing Google locations.");
      return;
    }
  
    try {
      setMessage("Syncing Google locations...");
  
      const res = await fetch(`/api/google/sync-locations?userId=${userId}`);
      const data = await res.json();
  
      if (data.success) {
        setMessage(
          `Synced ${data.savedCount || data.googleCount || 0} Google locations.`
        );
        await fetchLocations(userId);
      } else {
        setMessage(data.error || "Could not sync Google locations.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while syncing Google locations.");
    }
  }

  async function fetchLocations(currentUserId = userId) {
    if (!currentUserId) return;
  
    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("user_id", currentUserId)
      .order("id", { ascending: false });
  
    if (data) {
      setLocations(data);
  
      const firstLocationId = data[0]?.id || null;
  
      setSelectedLocationId(firstLocationId);
  
      if (firstLocationId) {
        await fetchReviews(currentUserId, firstLocationId);
      } else {
        setReviews([]);
      }
    }
  }

  async function selectLocation(locationId: number) {
    setSelectedLocationId(locationId);
    await fetchReviews(userId, locationId);
  }

  async function fetchReviews(
    currentUserId = userId,
    currentLocationId = selectedLocationId
  ) {
    if (!currentUserId) return;

    let query = supabase
      .from("reviews")
      .select("*")
      .eq("user_id", currentUserId)
      .order("id", { ascending: false });

    if (currentLocationId) {
      query = query.eq("location_id", currentLocationId);
    }

    const { data } = await query;

    if (data) setReviews(data);
  }

  async function fetchBusinessProfile(currentUserId = userId) {
    if (!currentUserId) return;

    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", currentUserId)
      .limit(1)
      .maybeSingle<BusinessProfile>();

    if (data) {
      setProfileId(data.id);
      setBusinessName(data.name || "");
      setBusinessInfo(data.business_info || "");
      setTone(data.tone || "professional");
    }
  }

  async function saveBusinessProfile() {
    if (!userId) return;

    setSavingProfile(true);

    if (profileId) {
      await supabase
        .from("business_profiles")
        .update({
          name: businessName,
          business_info: businessInfo,
          tone,
        })
        .eq("id", profileId)
        .eq("user_id", userId);
    } else {
      const { data } = await supabase
        .from("business_profiles")
        .insert({
          name: businessName,
          business_info: businessInfo,
          tone,
          user_id: userId,
        })
        .select()
        .single();

      if (data) setProfileId(data.id);
    }

    setMessage("Business profile saved.");
    setSavingProfile(false);
  }

  async function importGoogleReviews() {
    if (!userId) {
      setMessage("Please log in again before checking Google reviews.");
      return;
    }
  
    if (!selectedLocationId) {
      setMessage("Please select a location before checking Google reviews.");
      return;
    }
  
    try {
      setImporting(true);
      setMessage("Checking Google for new reviews...");
  
      const res = await fetch("/api/google/import-reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          locationId: selectedLocationId,
        }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        setMessage(
          `Google reviews checked. Fetched: ${data.fetched}, inserted: ${data.inserted}, updated: ${data.updated}.`
        );
        await fetchReviews(userId, selectedLocationId);
      } else {
        setMessage(data.error || "Could not check Google reviews.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while checking Google reviews.");
    }
  
    finally {
      setImporting(false);
    }
  }

  async function generateNext10Replies() {
    if (!userId) {
      setMessage("Please log in again before drafting AI replies.");
      return;
    }
  
    if (!selectedLocationId) {
      setMessage("Please select a location before drafting AI replies.");
      return;
    }
  
    if (needsAiReplyCount === 0) {
      setMessage("No reviews need AI replies right now.");
      return;
    }
  
    try {
      setBulkGenerating(true);
      setMessage("Drafting AI replies...");
  
      const res = await fetch("/api/generate-bulk-replies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          locationId: selectedLocationId,
          tone,
          businessInfo,
          limit: 10,
        }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        setMessage(`Drafted ${data.generated} AI replies.`);
        await fetchReviews(userId, selectedLocationId);
      } else {
        setMessage(data.error || "Could not draft AI replies.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while drafting AI replies.");
    }
  finally
  {
    setBulkGenerating(false);
  }
  }
  async function generateReplyForSavedReview(item: Review) {
    if (!userId) {
      setMessage("Please log in again before drafting an AI reply.");
      return;
    }
  
    if (!item.review_text) {
      setMessage("This review has no written text to reply to.");
      return;
    }
  
    try {
      setGeneratingId(item.id);
      setMessage("Drafting AI reply...");
  
      const res = await fetch("/api/generate-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review: item.review_text,
          tone,
          businessInfo,
          userId,
          locationId: item.location_id,
          reviewId: item.id,
        }),
      });
  
      const data = await res.json();
  
      if (data.response) {
        await supabase
          .from("reviews")
          .update({
            ai_response: data.response,
          })
          .eq("id", item.id)
          .eq("user_id", userId);
  
        setMessage("AI reply drafted.");
        await fetchReviews(userId, selectedLocationId);
      } else {
        setMessage(data.error || "Could not draft AI reply.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while drafting the AI reply.");
    }
  finally {
    setGeneratingId(null);
  }
  }
  async function postReplyToGoogle(item: Review) {
    if (!userId) {
      setMessage("Please log in again before publishing to Google.");
      return;
    }
  
    if (!item.google_review_name) {
      setMessage("This review is missing its Google review ID.");
      return;
    }
  
    const finalReply = editingReplies[item.id] ?? item.ai_response;
  
    if (!finalReply || !finalReply.trim()) {
      setMessage("Please draft or write a reply before publishing.");
      return;
    }
  
    try {
      setPostingId(item.id);
      setMessage("Publishing reply to Google...");
  
      const res = await fetch("/api/google/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          reviewName: item.google_review_name,
          comment: finalReply,
        }),
      });
  
      const data = await res.json();
  
      if (data.status === 200) {
        const { error } = await supabase
          .from("reviews")
          .update({
            ai_response: finalReply,
            review_reply: finalReply,
            posted_to_google: true,
          })
          .eq("id", item.id)
          .eq("user_id", userId);
  
        if (error) {
          setMessage(
            `Reply was published to Google, but the app could not update the database: ${error.message}`
          );
        } else {
          setMessage("Reply published to Google successfully.");
          await fetchReviews(userId, selectedLocationId);
          await fetchSubscription(userId);
        }
      } else {
        setMessage(
          data.error ||
            data.raw ||
            "Google rejected the reply. Please try again."
        );
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while publishing to Google.");
    }
  finalReply
  {
    setPostingId(null);
  }
  }async function postAllReadyReplies() {
    if (!userId) {
      setMessage("Please log in again before publishing replies.");
      return;
    }
  
    const readyReviews = filteredReviews.filter(
      (review) =>
        review.google_review_name &&
        review.ai_response &&
        !review.review_reply &&
        !review.posted_to_google
    );
  
    if (readyReviews.length === 0) {
      setMessage("No approved replies are ready to publish.");
      return;
    }
  
    const confirmed = window.confirm(
      `Publish ${readyReviews.length} approved replies to Google? Please make sure you reviewed them first.`
    );
  
    if (!confirmed) return;
  
    try {
      setBulkPosting(true);
      setMessage(`Publishing ${readyReviews.length} approved replies to Google...`);
  
      let successCount = 0;
      let failCount = 0;
  
      for (const review of readyReviews) {
        try {
          const finalReply = editingReplies[review.id] ?? review.ai_response;
  
          if (!finalReply || !finalReply.trim()) {
            failCount++;
            continue;
          }
  
          const res = await fetch("/api/google/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId,
              reviewName: review.google_review_name,
              comment: finalReply,
            }),
          });
  
          const data = await res.json();
  
          if (data.status === 200) {
            const { error } = await supabase
              .from("reviews")
              .update({
                ai_response: finalReply,
                review_reply: finalReply,
                posted_to_google: true,
              })
              .eq("id", review.id)
              .eq("user_id", userId);
  
            if (error) {
              failCount++;
            } else {
              successCount++;
            }
          } else {
            failCount++;
          }
        } catch (error) {
          console.log(error);
          failCount++;
        }
      }
  
      await fetchReviews(userId, selectedLocationId);
      await fetchSubscription(userId);
  
      setMessage(
        `Publishing finished. Successful: ${successCount}. Failed: ${failCount}.`
      );
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong while publishing approved replies.");
    }
  finally {
    setBulkPosting(false);
  }
  }
  async function generateManualReply() {
    if (!manualReview.trim() || !userId) return;

    setLoading(true);

    const res = await fetch("/api/generate-response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        review: manualReview,
        tone,
        businessInfo,
        userId,
        locationId: selectedLocationId,
      }),
    });

    const data = await res.json();

    if (data.response) {
      setManualResponse(data.response);
      setManualReview("");
      await fetchReviews(userId, selectedLocationId);
    } else {
      setManualResponse(data.error || "Could not generate reply.");
    }

    setLoading(false);
  }

  async function deleteReview(id: number) {
    if (!userId) return;

    await supabase.from("reviews").delete().eq("id", id).eq("user_id", userId);

    await fetchReviews(userId, selectedLocationId);
  }

  async function copyText(text: string, id: string | number) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);

    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  }
  async function openCustomerPortal() {
    if (!userId) {
      setMessage("Please log in again before managing your subscription.");
      return;
    }
  
    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
        }),
      });
  
      const data = await response.json();
  
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error || "Could not open subscription management.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong opening subscription management.");
    }
  }
  async function createCheckoutSession(plan: "starter" | "pro") {
    if (!userId) {
      setMessage("Please log in again before upgrading your plan.");
      return;
    }
  
    try {
      setMessage("Opening secure checkout...");
  
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          plan,
        }),
      });
  
      const data = await res.json();
  
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error || "Could not start checkout.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Something went wrong opening checkout.");
    }
  }
  useEffect(() => {
    checkUser();
  }, []);

  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId
  );
  const filteredReviews = reviews.filter((review) => {
    const replied =
      review.review_reply ||
      review.posted_to_google;
  
    if (reviewFilter === "pending") {
      return !replied;
    }
  
    if (reviewFilter === "replied") {
      return replied;
    }
  
    return true;
  });
  
  const pendingCount = reviews.filter(
    (r) => !r.review_reply && !r.posted_to_google
  ).length;
  
  const repliedCount = reviews.filter(
    (r) => r.review_reply || r.posted_to_google
  ).length;
  
  const averageRating =
  reviews.length > 0
    ? (
        reviews.reduce(
          (sum, review) => sum + (review.rating || 0),
          0
        ) / reviews.filter((r) => r.rating).length
      ).toFixed(1)
    : "0.0";

const aiRepliesGenerated = reviews.filter(
  (r) => r.ai_response
).length;
const readyToPostCount = reviews.filter(
  (r) =>
    r.google_review_name &&
    r.ai_response &&
    !r.review_reply &&
    !r.posted_to_google
).length;
  const usagePercent = subscription
  ? Math.min(
      100,
      Math.round(
        (subscription.reviews_used / subscription.review_limit) * 100
      )
    )
  : 0;
  const needsAiReplyCount = reviews.filter(
    (r) =>
      !r.ai_response &&
      !r.review_reply &&
      !r.posted_to_google
  ).length;
  const completedReplyCount = reviews.filter(
    (r) => r.review_reply || r.posted_to_google
  ).length;
  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-3 text-5xl font-bold">AI Review Responder</h1>
            <p className="text-zinc-400">
  Manage, draft, and publish Google review replies in one place.
</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={connectGoogle}
              className="rounded-xl bg-white px-5 py-3 font-medium text-black"
            >
              Connect Google Business Profile
            </button>

            <button
              onClick={syncGoogleLocations}
              className="rounded-xl bg-zinc-800 px-5 py-3 font-medium text-white"
            >
              Refresh Locations
            </button>

            <button
              onClick={logout}
              className="rounded-xl bg-red-600 px-5 py-3 font-medium text-white"
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl bg-zinc-900 p-4 text-zinc-300">
            {message}
          </div>
        )}
       
       <div className="mb-8">
  <h1 className="text-4xl font-bold">
    👋 Welcome, {userEmail ? userEmail.split("@")[0] : "there"}
  </h1>

  <p className="mt-2 text-lg text-zinc-400">
    Let&apos;s take care of your reviews today.
  </p>
</div>

<section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">⭐ Average Rating</p>
    <h3 className="mt-2 text-4xl font-bold">{averageRating}</h3>
  </div>

  <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">💬 Pending Reviews</p>
    <h3 className="mt-2 text-4xl font-bold">{pendingCount}</h3>
  </div>

  <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">🤖 AI Replies</p>
    <h3 className="mt-2 text-4xl font-bold">{aiRepliesGenerated}</h3>
  </div>

  <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">✅ Posted Replies</p>
    <h3 className="mt-2 text-4xl font-bold">{repliedCount}</h3>
  </div>
</section>

{reviews.length === 0 && (
  <div className="mb-8 rounded-3xl bg-zinc-950 p-6 text-zinc-400 ring-1 ring-zinc-800">
    Connect your Google Business Profile, sync your locations, then import reviews to see your dashboard insights.
  </div>
)}
{subscription && (
  <section className="mb-8 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">

<div className="flex-1">

  <h2 className="text-3xl font-bold">
    {subscription.plan === "free" && "🆓 Free Plan"}
    {subscription.plan === "starter" && "⭐ Starter Plan"}
    {subscription.plan === "pro" && "🚀 Pro Plan"}
  </h2>
  {subscription.cancel_at_period_end && subscription.cancel_at && (
  <div className="mt-4 rounded-2xl bg-yellow-950 p-4 text-yellow-200 ring-1 ring-yellow-800">
    Your subscription is scheduled to cancel on{" "}
    {new Date(subscription.cancel_at).toLocaleDateString()}.
    You can manage or reactivate it from Manage Subscription.
  </div>
)}

  <p className="mt-2 text-zinc-400">
    {usagePercent}% of this month's replies used
  </p>

  <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
    <div
      className="h-full rounded-full bg-blue-600 transition-all duration-700"
      style={{
        width: `${usagePercent}%`,
      }}
    />
  </div>

  <div className="mt-6 grid grid-cols-2 gap-6">

    <div>
      <p className="text-sm text-zinc-500">
        Replies Used
      </p>

      <p className="text-3xl font-bold">
        {subscription.reviews_used}
      </p>
    </div>

    <div>
      <p className="text-sm text-zinc-500">
        Remaining
      </p>

      <p className="text-3xl font-bold">
        {Math.max(
          0,
          subscription.review_limit -
            subscription.reviews_used
        )}
      </p>
    </div>

  </div>

</div>

<div className="flex flex-col gap-3">

<button
  onClick={() => createCheckoutSession("starter")}
  disabled={subscription.plan === "starter" || subscription.plan === "pro"}
  className={`rounded-xl px-6 py-3 font-medium ${
    subscription.plan === "starter" || subscription.plan === "pro"
      ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
      : "bg-white text-black"
  }`}
>
  {subscription.plan === "starter"
    ? "Current Plan"
    : subscription.plan === "pro"
    ? "Starter Included"
    : "⭐ Upgrade to Starter"}
</button>

<button
  onClick={() => {
    if (subscription.plan === "starter") {
      openCustomerPortal();
    } else {
      createCheckoutSession("pro");
    }
  }}
  disabled={subscription.plan === "pro"}
  className={`rounded-xl px-6 py-3 font-medium text-white ${
    subscription.plan === "pro"
      ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
      : "bg-blue-600"
  }`}
>
  {subscription.plan === "pro"
    ? "Current Plan"
    : subscription.plan === "starter"
    ? "Upgrade to Pro"
    : "🚀 Upgrade to Pro"}
</button>
{subscription.plan !== "free" && (
  <button
    onClick={openCustomerPortal}
    className="rounded-xl bg-zinc-800 px-6 py-3 text-white"
  >
    Manage Subscription
  </button>
)}

</div>

</div>
  </section>
)}
      <section className="mb-8 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
  <h2 className="text-2xl font-bold">
    How to use this dashboard
  </h2>

  <div className="mt-4 grid gap-4 text-sm text-zinc-400 md:grid-cols-2 lg:grid-cols-4">
    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <p className="font-semibold text-white">1. Connect Google</p>
      <p className="mt-2">
        Connect the Google account that manages your Business Profile.
      </p>
    </div>

    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <p className="font-semibold text-white">2. Check Reviews</p>
      <p className="mt-2">
        Refresh locations, choose a business, and check for new Google reviews.
      </p>
    </div>

    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <p className="font-semibold text-white">3. Draft Replies</p>
      <p className="mt-2">
        Let AI create reply drafts based on your business settings.
      </p>
    </div>

    <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <p className="font-semibold text-white">4. Review & Publish</p>
      <p className="mt-2">
        Edit each draft, approve it, and publish it to Google.
      </p>
    </div>
  </div>
  <div className="mt-6 rounded-2xl bg-zinc-900 p-4 text-sm text-zinc-400 ring-1 ring-zinc-800">
  Need help? Contact support at{" "}
  <a
    href="mailto:support@aireviewresponder.com"
    className="font-semibold text-white underline"
  >
    support@aireviewresponder.com
  </a>
</div>
<div className="mt-4 rounded-2xl bg-zinc-900 p-4 text-sm text-zinc-400 ring-1 ring-zinc-800">
  <p className="font-semibold text-white">Good to know</p>

  <ul className="mt-3 list-disc space-y-2 pl-5">
    <li>This app currently supports Google Business Profile reviews only.</li>
    <li>Replies should be reviewed before publishing.</li>
    <li>Only published replies count toward your monthly plan limit.</li>
    <li>If a Google connection expires, reconnect your Google Business Profile.</li>
  </ul>
</div>
</section>
        <section className="mb-8 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
        <h2 className="mb-2 text-3xl font-bold">Business Locations</h2>

<p className="mb-6 text-zinc-400">
  Choose the Google Business Profile location you want to manage.
</p>
          {locations.length === 0 && (
  <div className="rounded-2xl bg-zinc-900 p-5 text-zinc-400 ring-1 ring-zinc-800 md:col-span-2 lg:col-span-4">
   No business locations found yet. Click{" "}
<span className="font-semibold text-white">
  Connect Google Business Profile
</span>
, then click{" "}
<span className="font-semibold text-white">
  Refresh Locations
</span>
.
    Click <span className="font-semibold text-white">Connect Google</span>, then click <span className="font-semibold text-white">Sync Locations</span>.
  </div>
)}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {locations.map((location) => (
              <div
                key={location.id}
                className={`rounded-2xl p-5 ring-1 ${
                  selectedLocationId === location.id
                    ? "bg-white text-black ring-white"
                    : "bg-zinc-900 text-white ring-zinc-800"
                }`}
              >
                <h3 className="text-lg font-semibold">{location.name}</h3>

                <p className="mt-2 text-sm opacity-70">
                  {location.address || "No address"}
                </p>

                <p className="mt-2 text-sm opacity-70">
                  Platform: {location.platform || "manual"}
                </p>

                <button
                  onClick={() => selectLocation(location.id)}
                  className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-white"
                >
                  Select
                </button>
              </div>
            ))}
          </div>

          {selectedLocation && (
            <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl bg-zinc-900 p-5 md:flex-row md:items-center">
              <p className="text-zinc-300">
                Active location:{" "}
                <span className="font-semibold text-white">
                  {selectedLocation.name}
                </span>
              </p>

              <button
                onClick={importGoogleReviews}
                disabled={importing}
                className="rounded-xl bg-green-600 px-5 py-3 font-medium text-white"
              >
               {importing ? "Checking Google..." : "Check for New Google Reviews"}
              </button>
              <button
  onClick={generateNext10Replies}
  disabled={bulkGenerating || needsAiReplyCount === 0}
  className={`rounded-xl px-5 py-3 font-medium text-white ${
    needsAiReplyCount === 0
      ? "cursor-not-allowed bg-zinc-700"
      : "bg-blue-600"
  }`}
>
  {bulkGenerating
    ? "Generating..."
    : `Draft AI Replies (${needsAiReplyCount})`}
</button>
  
{reviewFilter !== "replied" && (
  <div className="flex flex-col gap-2">
    <button
      onClick={postAllReadyReplies}
      disabled={bulkPosting || readyToPostCount === 0}
      className={`rounded-xl px-5 py-3 font-medium text-white ${
        readyToPostCount === 0
          ? "cursor-not-allowed bg-zinc-700"
          : "bg-green-700"
      }`}
    >
      {bulkPosting
        ? "Publishing..."
        : `Publish Approved Replies (${readyToPostCount})`}
    </button>

    <p className="text-xs text-zinc-500">
      Replies are published publicly to your Google Business Profile.
    </p>
  </div>
)}
            </div>
          )}
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <h2 className="mb-2 text-3xl font-bold">AI Reply Settings</h2>

<p className="mb-6 text-zinc-400">
  Tell the AI how your business should sound when replying to reviews.
</p>

            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business Name"
              className="mb-4 w-full rounded-xl bg-zinc-900 p-4"
            />

            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mb-4 w-full rounded-xl bg-zinc-900 p-4"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury</option>
              <option value="funny">Funny</option>
              <option value="apologetic">Apologetic</option>
            </select>

            <textarea
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder="Describe your business, service style, tone, popular dishes, policies, and anything the AI should know before replying.Business information"
              className="h-48 w-full rounded-xl bg-zinc-900 p-4"
            />

            <button
              onClick={saveBusinessProfile}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black"
            >
              {savingProfile ? "Saving..." : "Save AI Settings"}
            </button>
          </section>

          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <h2 className="mb-2 text-3xl font-bold">Manual Reply Draft</h2>

<p className="mb-6 text-zinc-400">
  Paste any review here to create a quick AI reply without importing it from Google.
</p>

            <textarea
              value={manualReview}
              onChange={(e) => setManualReview(e.target.value)}
              placeholder="Paste a customer review here..."
              className="h-48 w-full rounded-xl bg-zinc-900 p-4"
            />

            <button
              onClick={generateManualReply}
              disabled={loading}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black"
            >
              {loading ? "Generating..." : "Draft Reply"}
            </button>

            {manualResponse && (
              <div className="mt-6 rounded-2xl bg-zinc-900 p-5">
                <p className="text-zinc-300">{manualResponse}</p>
              </div>
            )}  
          </section>
        </div>

        <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
        <h2 className="mb-2 text-3xl font-bold">
  Review Queue{" "}
  {selectedLocation ? `for ${selectedLocation.name}` : ""}
</h2>

<p className="mb-6 text-zinc-400">
  Draft, review, edit, and publish replies to your Google reviews.
</p>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
  <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">Needs AI Reply</p>
    <p className="mt-1 text-3xl font-bold text-yellow-400">
      {needsAiReplyCount}
    </p>
  </div>

  <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">Ready to Post</p>
    <p className="mt-1 text-3xl font-bold text-blue-400">
      {readyToPostCount}
    </p>
  </div>

  <div className="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
    <p className="text-sm text-zinc-500">Published</p>
    <p className="mt-1 text-3xl font-bold text-green-400">
      {completedReplyCount}
    </p>
  </div>
</div>
          <div className="mb-6 flex flex-wrap gap-3">
  <button
    onClick={() => setReviewFilter("pending")}
    className={`rounded-xl px-4 py-2 ${
      reviewFilter === "pending"
        ? "bg-blue-600 text-white"
        : "bg-zinc-800 text-white"
    }`}
  >
    Needs Attention ({pendingCount})
  </button>

  <button
    onClick={() => setReviewFilter("replied")}
    className={`rounded-xl px-4 py-2 ${
      reviewFilter === "replied"
        ? "bg-green-600 text-white"
        : "bg-zinc-800 text-white"
    }`}
  >
    Published ({repliedCount})
  </button>

  <button
    onClick={() => setReviewFilter("all")}
    className={`rounded-xl px-4 py-2 ${
      reviewFilter === "all"
        ? "bg-purple-600 text-white"
        : "bg-zinc-800 text-white"
    }`}
  >
    All ({reviews.length})
  </button>
</div>

          <div className="space-y-4">
          {filteredReviews.map((item) => (
              <div key={item.id} className="rounded-2xl bg-zinc-900 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {item.reviewer_name || "Google Reviewer"}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {item.rating ? `${item.rating} stars` : "No rating"} •{" "}
                      {item.platform || "google"}
                    </p>
                  </div>

                  {item.review_reply || item.posted_to_google ? (
  <span className="rounded-full bg-green-700 px-3 py-1 text-sm">
    Replied
  </span>
) : item.ai_response ? (
  <span className="rounded-full bg-blue-700 px-3 py-1 text-sm">
    Ready to Post
  </span>
) : (
  <span className="rounded-full bg-yellow-700 px-3 py-1 text-sm">
    Needs Reply
  </span>
)}
                </div>

                <p className="mb-4 whitespace-pre-wrap text-zinc-300">
                  {item.review_text || "No written review."}
                </p>

                {item.ai_response && !item.review_reply && !item.posted_to_google && (
  <div className="mb-4 rounded-xl bg-black p-4">
    <p className="mb-2 text-sm text-zinc-500">
    Draft Reply — Review before posting
    </p>

    <textarea
      value={
        editingReplies[item.id] ??
        item.ai_response ??
        ""
      }
      onChange={(e) =>
        setEditingReplies((prev) => ({
          ...prev,
          [item.id]: e.target.value,
        }))
      }
      className="min-h-[140px] w-full rounded-xl bg-zinc-900 p-4 text-zinc-300"
    />
  </div>
)}

                {item.review_reply && (
                  <div className="mb-4 rounded-xl bg-green-950 p-4">
                    <p className="mb-2 text-sm text-green-400">
                    Published Google Reply
                    </p>
                    <p className="whitespace-pre-wrap text-zinc-300">
                      {item.review_reply}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  
                  {!item.review_reply && !item.posted_to_google && (
                    <button
                    onClick={() => generateReplyForSavedReview(item)}
                    disabled={generatingId === item.id}
                    className="rounded-xl bg-white px-4 py-2 text-black"
                  >
                    {generatingId === item.id
                      ? "Generating..."
                      : item.ai_response
                      ? "Regenerate AI Reply"
                      : "Generate AI Reply"}
                  </button>
                )}

{item.ai_response && !item.review_reply && !item.posted_to_google && (
                    <button
                      onClick={() => copyText(item.ai_response || "", item.id)}
                      className="rounded-xl bg-zinc-700 px-4 py-2 text-white"
                    >
                      {copiedId === item.id ? "Copied!" : "Copy Reply"}
                    </button>
                  )}

{item.google_review_name &&
  item.ai_response &&
  !item.review_reply &&
  !item.posted_to_google && (
    <button
    onClick={() => {
      const confirmed = window.confirm(
        "Post this reply to Google? You can still edit the draft before posting."
      );
    
      if (confirmed) {
        postReplyToGoogle(item);
      }
    }}
      disabled={postingId === item.id}
      className="rounded-xl bg-green-600 px-4 py-2 text-white"
    >
      {postingId === item.id ? "Posting..." : "Post to Google"}
    </button>
  )}

{(item.review_reply || item.posted_to_google) && (
  <span className="rounded-xl bg-green-900 px-4 py-2 text-green-300">
    ✓ Already replied on Google
  </span>
)}

                  <button
                    onClick={() => deleteReview(item.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

{reviews.length === 0 && (
  <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-400 ring-1 ring-zinc-800">
    No reviews imported yet. Select a location, then click{" "}
    <span className="font-semibold text-white">
      Import Google Reviews
    </span>
    .
  </div>
)}

{reviews.length > 0 && filteredReviews.length === 0 && reviewFilter === "pending" && (
  <div className="rounded-2xl bg-green-950 p-6 text-green-300 ring-1 ring-green-900">
    🎉 All caught up. There are no pending reviews waiting for a reply.
  </div>
)}

{reviews.length > 0 && filteredReviews.length === 0 && reviewFilter === "replied" && (
  <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-400 ring-1 ring-zinc-800">
    No replied reviews found yet.
  </div>
)}
          </div>
        </section>
      </section>
    </main>
  );
}