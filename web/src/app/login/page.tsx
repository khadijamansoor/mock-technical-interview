"use client";

import { useState, useEffect } from "react";
import { login, signup } from "./actions";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setError(decodeURIComponent(err));
    }
  }, []);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const res = await signup(formData);
        if (res?.error) setError(res.error);
        if (res?.message) setMessage(res.message);
      } else {
        const res = await login(formData);
        if (res?.error) setError(res.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (message) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-surface-hover rounded-xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-accent-secondary/10 text-accent-secondary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-3">
            Check your email
          </h1>
          <p className="text-text-muted mb-6 font-sans leading-relaxed">
            {message}
          </p>
          <button
            onClick={() => {
              setMessage(null);
              setIsSignUp(false);
            }}
            className="w-full py-3 px-4 bg-surface border border-surface-hover hover:bg-surface-hover text-text-primary font-semibold rounded-lg transition-colors font-sans"
          >
            Back to Log In
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-surface-hover rounded-xl p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-text-muted mt-2 font-sans">
            {isSignUp ? "Sign up to start your mock interviews." : "Log in to your account to continue."}
          </p>
        </div>

        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1 font-sans" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-2 bg-bg-base border border-surface-hover rounded-lg text-text-primary focus:outline-none focus:border-accent-secondary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1 font-sans" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full px-4 py-2 bg-bg-base border border-surface-hover rounded-lg text-text-primary focus:outline-none focus:border-accent-secondary transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 bg-accent-alert/10 border border-accent-alert/20 text-accent-alert text-sm rounded-lg font-sans">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-accent-secondary/10 border border-accent-secondary/20 text-accent-secondary text-sm rounded-lg font-sans">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-accent-secondary text-surface font-semibold rounded-lg hover:bg-opacity-90 transition-all shadow-[0_0_15px_rgba(79,209,197,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-sans mt-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isSignUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm font-sans text-text-muted">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
            }}
            className="text-accent-secondary hover:underline font-medium"
          >
            {isSignUp ? "Log In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
