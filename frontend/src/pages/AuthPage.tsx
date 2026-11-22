import { useState, type FormEvent } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { ApiErrorResponse } from "../types/game";

interface AuthPageProps {
  mode: "login" | "register";
  initialError?: string | null;
}

export function AuthPage({ mode, initialError }: AuthPageProps) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const isRegistration = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (isRegistration && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegistration) {
        await register({ username: username.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(authErrorMessage(requestError, mode));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="card auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand-mark" aria-hidden="true">◇</div>
        <h1 id="auth-heading">{isRegistration ? "Create your account" : "Welcome back"}</h1>
        <p className="muted auth-intro">
          {isRegistration ? "Join the gaming knowledge community." : "Sign in to continue to your game library and conversations."}
        </p>

        {error && <div className="form-api-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistration && (
            <div className="form-field">
              <label htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                maxLength={100}
                disabled={submitting}
              />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={320}
              disabled={submitting}
            />
          </div>
          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isRegistration ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={isRegistration ? 8 : 1}
              maxLength={128}
              disabled={submitting}
            />
          </div>
          {isRegistration && (
            <div className="form-field">
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                id="auth-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                minLength={8}
                maxLength={128}
                disabled={submitting}
              />
            </div>
          )}
          <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : isRegistration ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistration ? "Already registered?" : "New to the agent?"}{" "}
          <Link to={isRegistration ? "/login" : "/register"}>
            {isRegistration ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}

function authErrorMessage(error: unknown, mode: AuthPageProps["mode"]): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "We couldn't complete that request. Try again.";
  }
  if (!error.response) return "We couldn't reach the server. Check your connection and try again.";
  if (error.response.status === 401) return "The email or password is incorrect.";
  if (error.response.status === 409) {
    const data = error.response.data as ApiErrorResponse;
    const message = data?.error?.message?.toLowerCase() ?? "";
    if (message.includes("email")) return "That email address is already registered.";
    if (message.includes("username")) return "That username is already in use.";
    return "An account with those details already exists.";
  }
  if (error.response.status === 400) {
    return mode === "register"
      ? "Check the username, email, and password requirements and try again."
      : "Enter a valid email and password.";
  }
  return "We couldn't complete that request. Please try again.";
}