import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

/**
 * Client-side half of phone-OTP verification (see Settings > Profile) — the
 * whole send-OTP/confirm-OTP round-trip happens directly between this
 * browser and Firebase, never through our own backend (that's the entire
 * point of Firebase Phone Auth, and why 50 people verifying at once is a
 * non-issue for our infra — see backend's FirebasePhoneVerificationService
 * docblock). Our backend's only involvement is verifying the resulting ID
 * token once, server-side, before trusting it.
 *
 * Lazily initialised (never at module load) — this file is imported from a
 * "use client" page, but Next.js still evaluates client modules during SSR
 * for the initial render pass, and Firebase's SDK touches `window`
 * immediately on init, which doesn't exist there.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function isFirebasePhoneAuthConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

/**
 * One invisible reCAPTCHA instance per mounted verify panel, attached to a
 * real DOM node (`containerId`) that must exist before this is called.
 * Firebase requires a fresh verifier if a previous send attempt errored —
 * see resetPhoneRecaptcha().
 */
let recaptchaVerifier: RecaptchaVerifier | null = null;

function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: "invisible" });
  }
  return recaptchaVerifier;
}

/** Must be called after any failed send attempt — a used/errored verifier can't be reused for the next try. */
export function resetPhoneRecaptcha(): void {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

/** @param e164Phone Full E.164 number, e.g. "+919876543210". */
export async function sendPhoneOtp(e164Phone: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier(recaptchaContainerId);
  return signInWithPhoneNumber(getFirebaseAuth(), e164Phone, verifier);
}

/** Confirms the 6-digit OTP and returns a fresh Firebase ID token proving this phone was verified — sent to our backend, never the phone number itself (see PhoneVerificationController). */
export async function confirmPhoneOtp(confirmationResult: ConfirmationResult, otp: string): Promise<string> {
  const credential = await confirmationResult.confirm(otp);
  return credential.user.getIdToken();
}

/** Best-effort mapping of Firebase's error codes to what a candidate should actually read — falls back to Firebase's own message for anything unmapped rather than hiding it. */
export function friendlyFirebaseError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;

  switch (code) {
    case "auth/invalid-phone-number":
      return "That doesn't look like a valid phone number.";
    case "auth/too-many-requests":
      return "Too many attempts — please wait a while before trying again.";
    case "auth/code-expired":
      return "That code expired — request a new one.";
    case "auth/invalid-verification-code":
      return "That code isn't correct. Please check and try again.";
    case "auth/quota-exceeded":
      return "SMS verification is temporarily at capacity — please try again shortly.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}
