"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
      }
    }

    redirectIfLoggedIn();
  }, [router]);
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            AI Review Responder
          </h1>

          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-zinc-800 px-5 py-3 font-medium text-white"
            >
              Login
            </Link>

            <Link
              href="/login"
              className="rounded-xl bg-white px-5 py-3 font-medium text-black"
            >
              Get Started
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-300 ring-1 ring-zinc-800">
              Google Review Management with AI
            </p>

            <h2 className="text-5xl font-bold leading-tight md:text-6xl">
              Respond to Google reviews faster with AI.
            </h2>

            <p className="mt-6 text-xl leading-8 text-zinc-400">
              Connect your Google Business Profile, draft replies in your brand
              voice, review them, and publish approved replies directly to
              Google.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-xl bg-white px-6 py-4 font-semibold text-black"
              >
                Start Free
              </Link>

              <Link
                href="/login"
                className="rounded-xl bg-zinc-900 px-6 py-4 font-semibold text-white ring-1 ring-zinc-800"
              >
                Login
              </Link>
            </div>

            <p className="mt-4 text-sm text-zinc-500">
              Free plan includes 5 published replies per month.
            </p>
          </div>

          <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
            <div className="rounded-2xl bg-zinc-900 p-5">
              <p className="text-sm text-zinc-500">New Google Review</p>
              <p className="mt-3 text-zinc-300">
                “Amazing food and friendly service. We’ll definitely be back!”
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-blue-950 p-5 ring-1 ring-blue-900">
              <p className="text-sm text-blue-300">
                Draft Reply — Review before posting
              </p>
              <p className="mt-3 text-zinc-200">
                Thank you so much for your kind words! We’re happy you enjoyed
                the food and service, and we look forward to welcoming you back
                soon.
              </p>
            </div>

            <button className="mt-5 w-full rounded-xl bg-green-700 px-5 py-3 font-medium text-white">
              Publish Approved Reply
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-bold">
            How it works
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              "Connect Google",
              "Check for reviews",
              "Draft AI replies",
              "Review and publish",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800"
              >
                <p className="text-sm text-zinc-500">
                  Step {index + 1}
                </p>
                <h3 className="mt-3 text-xl font-bold">
                  {step}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-bold">
            Simple pricing
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
              <h3 className="text-2xl font-bold">Free</h3>
              <p className="mt-2 text-zinc-400">5 replies/month</p>
              <p className="mt-6 text-4xl font-bold">$0</p>
            </div>

            <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-blue-700">
              <h3 className="text-2xl font-bold">Starter</h3>
              <p className="mt-2 text-zinc-400">100 replies/month</p>
              <p className="mt-6 text-4xl font-bold">$11</p>
              <p className="mt-1 text-sm text-zinc-500">per month</p>
            </div>

            <div className="rounded-3xl bg-zinc-950 p-6 ring-1 ring-zinc-800">
              <h3 className="text-2xl font-bold">Pro</h3>
              <p className="mt-2 text-zinc-400">1000 replies/month</p>
              <p className="mt-6 text-4xl font-bold">$27</p>
              <p className="mt-1 text-sm text-zinc-500">per month</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}