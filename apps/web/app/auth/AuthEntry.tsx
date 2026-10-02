"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, isAuthPreviewEnabled, isDynamicAuthConfigured } from "../../lib/pact-storage";
import { financialApi } from "../../lib/financial-api";
import { listAgreements } from "../../lib/agreement-api";
import { usePactAuth } from "../components/PactAuthProvider";

export default function AuthEntry({ intent }: { intent: "organizer" | "payee" }) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const { configured, ready, user, openAuth, sendEmailCode, verifyEmailCode, signOut } = usePactAuth();
  const continueAfterAuthentication = useRef(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState<"google" | "email" | "switch" | null>(null);

  useEffect(() => {
    if (user && (intent === "organizer" || continueAfterAuthentication.current)) void finishAuthentication(user);
  }, [user?.id, intent]);

  async function finishAuthentication(user: Awaited<ReturnType<typeof authClient.signInWithEmail>>) {
    const events = isDynamicAuthConfigured ? await financialApi.listEvents().catch(()=>[]) : [];
    const pendingAgreements = isDynamicAuthConfigured ? await listAgreements().catch(()=>[]) : [];
    const destination = intent === "payee" ? "/agreements" : events.length > 0 ? "/dashboard" : pendingAgreements.length > 0 ? "/agreements" : "/events/new";
    if (isDynamicAuthConfigured) router.replace(destination);
    else window.location.assign(destination);
  }

  async function continueWithGoogle() {
    if (pending || !configured) return;
    setFormError("");
    if (isDynamicAuthConfigured) {
      continueAfterAuthentication.current = true;
      openAuth();
      return;
    }

    setPending("google");
    try {
      await finishAuthentication(await authClient.signInWithGoogle());
    } catch {
      setFormError("We couldn’t start your session. Please try again.");
      setPending(null);
    }
  }

  async function continueWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !configured) return;
    setFormError("");
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setEmailError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    setEmailError("");
    continueAfterAuthentication.current = true;
    setPending("email");
    try {
      if (isDynamicAuthConfigured) {
        await sendEmailCode(normalizedEmail);
        setEmailSent(true);
        setPending(null);
        requestAnimationFrame(() => codeRef.current?.focus());
      } else {
        await finishAuthentication(await authClient.signInWithEmail(normalizedEmail));
      }
    } catch {
      setFormError("We couldn’t send a verification code. Check your email and try again.");
      setPending(null);
    }
  }

  async function useAnotherAccount() {
    if (pending) return;
    setPending("switch"); setFormError("");
    try { await signOut(); continueAfterAuthentication.current = false; setEmail(""); setCode(""); setEmailSent(false); }
    catch { setFormError("We couldn’t sign out of this account. Please try again."); }
    finally { setPending(null); }
  }

  async function confirmEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !/^\d{6}$/.test(code.trim())) {
      setFormError("Enter the 6-digit verification code from your email.");
      codeRef.current?.focus();
      return;
    }
    setFormError("");
    setPending("email");
    try {
      await verifyEmailCode(code.trim());
    } catch {
      setFormError("That code could not be verified. Check it and try again.");
      setPending(null);
    }
  }

  return <main className="auth-page">
    <section className="auth-brand-panel" aria-label="About Pact">
      <Link href="/" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to Pact</Link>
      <div><Image className="auth-logo" src="/pact-primary-logo.svg" alt="Pact" width={132} height={40} priority /><h1>Start with the event. See every dollar clearly.</h1><p>Create the financial workspace your team, sponsors, and payees can trust.</p></div>
      <p className="auth-brand-note">Committed funding never counts as cash until it arrives.</p>
    </section>
    <section className="auth-form-panel" aria-labelledby="auth-heading">
      <div className="auth-form-wrap">
        <p className="app-eyebrow">{intent === "payee" ? "Vendor access" : "Organizer access"}</p>
        <h2 id="auth-heading">{intent === "payee" ? "Review your agreement" : "Continue to Pact"}</h2>
        <p className="auth-lede">{intent === "payee" ? "Sign in with the verified email your organizer used. Your agreements will be waiting for you." : "Sign in or create your account. It only takes a moment."}</p>

        {!configured && <div className="app-banner app-banner-info" role="status"><strong>Authentication setup required</strong><span>Add your Dynamic environment ID to enable Google and verified email sign-in.</span></div>}
        {!isDynamicAuthConfigured && isAuthPreviewEnabled && <div className="auth-preview-note" role="note">Local authentication preview is enabled. Do not use this mode in production.</div>}
        {formError && <div className="app-banner app-banner-error" role="alert">{formError}</div>}

        {intent === "payee" && user && !continueAfterAuthentication.current ? <section className="auth-account-choice" aria-labelledby="current-account-heading"><p id="current-account-heading">Currently signed in as</p><strong>{user.email}</strong><span>Continue only if this is the email named on your agreement.</span><button className="app-primary-button" type="button" onClick={() => void finishAuthentication(user)}>Continue with this email <ArrowRight aria-hidden="true" /></button><button className="app-secondary-button" type="button" onClick={useAnotherAccount} disabled={pending === "switch"} aria-busy={pending === "switch"}>{pending === "switch" ? "Signing out…" : "Use a different email"}</button></section> : <>
        <button className="auth-provider-button" type="button" onClick={continueWithGoogle} disabled={Boolean(pending) || !configured || !ready} aria-busy={pending === "google"}>
          <span className="google-mark" aria-hidden="true">G</span>{pending === "google" ? "Continuing…" : "Continue with Google"}<ArrowRight aria-hidden="true" />
        </button>

        <div className="auth-divider"><span>or</span></div>

        {!emailSent ? <form onSubmit={continueWithEmail} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <div className="input-with-icon"><Mail aria-hidden="true" /><input ref={emailRef} id="email" name="email" type="email" autoComplete="email" spellCheck={false} placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => email && setEmailError(/^\S+@\S+\.\S+$/.test(email.trim()) ? "" : "Enter a valid email address.")} aria-invalid={emailError ? "true" : undefined} aria-describedby={emailError ? "email-error" : undefined} /></div>
            {emailError && <p className="field-error" id="email-error">{emailError}</p>}
          </div>
          <button className="app-primary-button" type="submit" disabled={Boolean(pending) || !configured || !ready} aria-busy={pending === "email"}>{pending === "email" ? "Sending code…" : "Continue with email"}<ArrowRight aria-hidden="true" /></button>
        </form> : <form onSubmit={confirmEmailCode} noValidate>
          <div className="form-field">
            <label htmlFor="code">Verification code</label>
            <input ref={codeRef} id="code" name="code" className="auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="code-hint" />
            <p className="field-hint" id="code-hint">We sent a 6-digit code to {email.trim()}.</p>
          </div>
          <button className="app-primary-button" type="submit" disabled={Boolean(pending) || code.length !== 6} aria-busy={pending === "email"}>{pending === "email" ? "Verifying…" : "Verify and continue"}<ArrowRight aria-hidden="true" /></button>
          <button className="auth-change-email" type="button" onClick={() => { setEmailSent(false); setCode(""); setFormError(""); }}>Use a different email</button>
        </form>}
        <p className="auth-terms">By continuing, you agree to Pact’s terms and privacy policy.</p></>}
      </div>
    </section>
  </main>;
}
