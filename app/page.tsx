"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Review = {
  id: number;
  review_text: string;
  ai_response: string;
  user_id: string | null;
};

type BusinessProfile = {
  id: number;
  name: string | null;
  business_info: string | null;
  tone: string | null;
  user_id: string | null;
};

export default function Home() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const [review, setReview] = useState("");
  const [response, setResponse] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tone, setTone] = useState("professional");
  const [businessName, setBusinessName] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | "latest" | null>(null);
  const [profileMessage, setProfileMessage] = useState("");

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    setUserId(session.user.id);
    setLoadingPage(false);

    fetchReviews(session.user.id);
    fetchBusinessProfile(session.user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function fetchReviews(currentUserId = userId) {
    if (!currentUserId) return;

    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", currentUserId)
      .order("id", { ascending: false });

    if (data) setReviews(data);
  }

  async function fetchBusinessProfile(currentUserId = userId) {
    if (!currentUserId) return;

    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", currentUserId)
      .order("id", { ascending: true })
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
    setProfileMessage("");

    if (profileId) {
      const { error } = await supabase
        .from("business_profiles")
        .update({
          name: businessName,
          business_info: businessInfo,
          tone,
          user_id: userId,
        })
        .eq("id", profileId)
        .eq("user_id", userId);

      if (error) {
        setProfileMessage("Could not save profile.");
      } else {
        setProfileMessage("Business profile saved.");
      }
    } else {
      const { data, error } = await supabase
        .from("business_profiles")
        .insert({
          name: businessName,
          business_info: businessInfo,
          tone,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        setProfileMessage("Could not save profile.");
      } else {
        setProfileId(data.id);
        setProfileMessage("Business profile saved.");
      }
    }

    setSavingProfile(false);
  }

  async function deleteReview(id: number) {
    if (!userId) return;

    await supabase
      .from("reviews")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    fetchReviews(userId);
  }

  async function copyText(text: string, id: number | "latest") {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  useEffect(() => {
    checkUser();
  }, []);

  async function generateReply() {
    if (!review.trim() || !userId) return;

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/generate-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          review,
          tone,
          businessInfo,
          userId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setResponse(data.error);
      } else {
        setResponse(data.response);
        setReview("");
        fetchReviews(userId);
      }
    } catch {
      setResponse("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-2xl">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-4 text-5xl font-bold">
              AI Review Responder
            </h1>

            <p className="text-zinc-400">
              Generate, save, and copy brand-aware review replies.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-xl bg-red-600 px-5 py-3 font-medium text-white"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
            <h2 className="mb-6 text-2xl font-semibold">
              Business Profile
            </h2>

            <label className="mb-2 block text-sm text-zinc-400">
              Business Name
            </label>

            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Example: Tikka Indian Cuisine"
              className="mb-6 w-full rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
            />

            <label className="mb-2 block text-sm text-zinc-400">
              Response Tone
            </label>

            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="mb-6 w-full rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury</option>
              <option value="funny">Funny</option>
              <option value="apologetic">Apologetic</option>
            </select>

            <label className="mb-2 block text-sm text-zinc-400">
              Business Information
            </label>

            <textarea
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder="Cuisine, location, popular dishes, service style, policies..."
              className="h-48 w-full rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
            />

            <button
              type="button"
              onClick={saveBusinessProfile}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black"
            >
              {savingProfile ? "Saving..." : "Save Business Profile"}
            </button>

            {profileMessage && (
              <p className="mt-4 text-sm text-zinc-400">
                {profileMessage}
              </p>
            )}
          </section>

          <section className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
            <h2 className="mb-6 text-2xl font-semibold">
              Generate New Reply
            </h2>

            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Paste customer review here..."
              className="h-48 w-full rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
            />

            <button
              type="button"
              onClick={generateReply}
              disabled={loading || !review.trim()}
              className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate AI Reply"}
            </button>

            {response && (
              <div className="mt-8 rounded-2xl bg-zinc-900 p-6">
                <h3 className="mb-4 text-xl font-semibold">
                  Latest AI Response
                </h3>

                <p className="mb-4 leading-8 text-zinc-300">
                  {response}
                </p>

                <button
                  type="button"
                  onClick={() => copyText(response, "latest")}
                  className="rounded-xl bg-white px-4 py-2 text-black"
                >
                  {copiedId === "latest" ? "Copied!" : "Copy Reply"}
                </button>
              </div>
            )}
          </section>
        </div>

        <section className="mt-10 rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold">
              Saved Reviews ({reviews.length})
            </h2>

            <button
              type="button"
              onClick={() => fetchReviews(userId)}
              className="rounded-xl bg-zinc-800 px-5 py-3"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-6">
            {reviews.map((item) => (
              <div key={item.id} className="rounded-2xl bg-zinc-900 p-6">
                <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
                  Customer Review
                </p>

                <p className="mb-6 text-zinc-300">
                  {item.review_text}
                </p>

                <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
                  AI Response
                </p>

                <p className="mb-6 text-zinc-400">
                  {item.ai_response}
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => copyText(item.ai_response, item.id)}
                    className="rounded-xl bg-white px-4 py-2 text-black"
                  >
                    {copiedId === item.id ? "Copied!" : "Copy Reply"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteReview(item.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}