"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signUp() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account created. Check your email if confirmation is required.");
    }
  }

  async function signIn() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="mb-3 text-4xl font-bold">
          Login
        </h1>

        <p className="mb-8 text-zinc-400">
          Sign in to your AI Review Responder account.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 rounded-xl bg-zinc-900 p-4 text-white outline-none ring-1 ring-zinc-800"
        />

        <button
          type="button"
          onClick={signIn}
          className="mb-3 rounded-xl bg-white px-6 py-3 font-medium text-black"
        >
          Sign In
        </button>

        <button
          type="button"
          onClick={signUp}
          className="rounded-xl bg-zinc-800 px-6 py-3 font-medium text-white"
        >
          Create Account
        </button>

        {message && (
          <p className="mt-6 rounded-xl bg-zinc-900 p-4 text-zinc-300">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}