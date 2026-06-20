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
    if (!userId) return;
    window.location.href = `/api/google/connect?userId=${userId}`;
  }

  async function syncGoogleLocations() {
    if (!userId) return;

    setMessage("Syncing Google locations...");

    const res = await fetch(`/api/google/sync-locations?userId=${userId}`);
    const data = await res.json();

    if (data.success) {
      setMessage(`Synced ${data.savedCount || data.googleCount || 0} locations.`);
      await fetchLocations(userId);
    } else {
      setMessage(data.error || "Could not sync Google locations.");
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
    if (!userId || !selectedLocationId) return;

    setImporting(true);
    setMessage("Importing Google reviews...");

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
        `Imported reviews. Fetched: ${data.fetched}, inserted: ${data.inserted}, updated: ${data.updated}.`
      );
      await fetchReviews(userId, selectedLocationId);
    } else {
      setMessage(data.error || "Could not import Google reviews.");
    }

    setImporting(false);
  }

  async function generateNext10Replies() {
    if (!userId || !selectedLocationId) return;
  
    setBulkGenerating(true);
    setMessage("Generating next 10 replies...");
  
    try {
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
        setMessage(`Generated ${data.generated} replies.`);
        await fetchReviews(userId, selectedLocationId);
      } else {
        setMessage(data.error || "Could not generate bulk replies.");
      }
    } catch (error) {
      console.log(error);
      setMessage("Bulk generation failed.");
    }
  
    setBulkGenerating(false);
  }
  async function generateReplyForSavedReview(item: Review) {
    if (!userId) return;

    setGeneratingId(item.id);

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

      setMessage("AI reply generated.");
      await fetchReviews(userId, selectedLocationId);
    } else {
      setMessage(data.error || "Could not generate reply.");
    }

    setGeneratingId(null);
  }

  async function postReplyToGoogle(item: Review) {
    if (!userId) {
      setMessage("Missing user ID.");
      return;
    }
  
    if (!item.google_review_name) {
      setMessage("Missing Google review name.");
      return;
    }
  
    if (!item.ai_response) {
      setMessage("Generate an AI reply first.");
      return;
    }
  
    setPostingId(item.id);
    setMessage("Posting reply to Google...");
  
    try {
      const finalReply =
  editingReplies[item.id] ??
  item.ai_response;
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
  
      console.log("Google reply response:", data);
  
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
          console.error(error);
          setMessage(
            `Reply posted to Google but DB update failed: ${error.message}`
          );
        } else {
          setMessage("Reply posted to Google successfully.");
          await fetchReviews(userId, selectedLocationId);
        }
      } else {
        setMessage(
          `Google reply failed: ${data.status || "unknown"} ${data.statusText || ""} ${data.raw || data.error || ""}`
);
  
        console.log("Google reply error:", data);
      }
    } catch (error) {
      console.log(error);
      setMessage("Post failed. Check browser console.");
    }
  
    setPostingId(null);
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

  async function createCheckoutSession(plan: "starter" | "pro") {
    if (!userId) return;
  
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
              Google Business Profile + AI review workflow
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={connectGoogle}
              className="rounded-xl bg-white px-5 py-3 font-medium text-black"
            >
              Connect Google
            </button>

            <button
              onClick={syncGoogleLocations}
              className="rounded-xl bg-zinc-800 px-5 py-3 font-medium text-white"
            >
              Sync Locations
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
{subscription && (
  <section className="mb-8 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-bold">Your Plan</h2>
        <p className="mt-2 text-zinc-400">
          Plan:{" "}
          <span className="font-semibold text-white">
            {subscription.plan}
          </span>
        </p>
        <p className="mt-1 text-zinc-400">
          Replies used: {subscription.reviews_used} /{" "}
          {subscription.review_limit}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
  <button
    onClick={() => createCheckoutSession("starter")}
    className="rounded-xl bg-white px-5 py-3 font-medium text-black"
  >
    Upgrade to Starter - $11/mo
  </button>

  <button
    onClick={() => createCheckoutSession("pro")}
    className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white"
  >
    Upgrade to Pro - $27/mo
  </button>
</div>
    </div>
  </section>
)}
        <section className="mb-8 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <h2 className="mb-6 text-3xl font-bold">Locations</h2>

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
                {importing ? "Importing..." : "Import Google Reviews"}
              </button>
              <button
  onClick={generateNext10Replies}
  disabled={bulkGenerating}
  className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white"
>
  {bulkGenerating ? "Generating..." : "Generate Next 10 Replies"}
</button>
            </div>
          )}
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
            <h2 className="mb-6 text-3xl font-bold">Business Profile</h2>

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
              placeholder="Business information"
              className="h-48 w-full rounded-xl bg-zinc-900 p-4"
            />

            <button
              onClick={saveBusinessProfile}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black"
            >
              {savingProfile ? "Saving..." : "Save Business Profile"}
            </button>
          </section>

          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
            <h2 className="mb-6 text-3xl font-bold">Manual Reply Generator</h2>

            <textarea
              value={manualReview}
              onChange={(e) => setManualReview(e.target.value)}
              placeholder="Paste review here"
              className="h-48 w-full rounded-xl bg-zinc-900 p-4"
            />

            <button
              onClick={generateManualReply}
              disabled={loading}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black"
            >
              {loading ? "Generating..." : "Generate AI Reply"}
            </button>

            {manualResponse && (
              <div className="mt-6 rounded-2xl bg-zinc-900 p-5">
                <p className="text-zinc-300">{manualResponse}</p>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <h2 className="mb-6 text-3xl font-bold">
            Google Reviews{" "}
            {selectedLocation ? `for ${selectedLocation.name}` : ""}
          </h2>
          <div className="mb-6 flex flex-wrap gap-3">
  <button
    onClick={() => setReviewFilter("pending")}
    className={`rounded-xl px-4 py-2 ${
      reviewFilter === "pending"
        ? "bg-blue-600 text-white"
        : "bg-zinc-800 text-white"
    }`}
  >
    Pending ({pendingCount})
  </button>

  <button
    onClick={() => setReviewFilter("replied")}
    className={`rounded-xl px-4 py-2 ${
      reviewFilter === "replied"
        ? "bg-green-600 text-white"
        : "bg-zinc-800 text-white"
    }`}
  >
    Replied ({repliedCount})
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
                  ) : (
                    <span className="rounded-full bg-yellow-700 px-3 py-1 text-sm">
                      Needs Reply
                    </span>
                  )}
                </div>

                <p className="mb-4 whitespace-pre-wrap text-zinc-300">
                  {item.review_text || "No written review."}
                </p>

                {item.ai_response && (
  <div className="mb-4 rounded-xl bg-black p-4">
    <p className="mb-2 text-sm text-zinc-500">
      AI Reply (Editable)
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
                      Existing Google Reply
                    </p>
                    <p className="whitespace-pre-wrap text-zinc-300">
                      {item.review_reply}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => generateReplyForSavedReview(item)}
                    disabled={generatingId === item.id}
                    className="rounded-xl bg-white px-4 py-2 text-black"
                  >
                    {generatingId === item.id
                      ? "Generating..."
                      : "Generate AI Reply"}
                  </button>

                  {item.ai_response && (
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
      onClick={() => postReplyToGoogle(item)}
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
              <p className="text-zinc-500">
                No reviews for this location yet. Click Import Google Reviews.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}