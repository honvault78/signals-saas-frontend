"use client";

import Image from "next/image";
import {
  SignedOut,
  SignedIn,
  SignInButton,
  SignUpButton,
  useAuth,
} from "@clerk/nextjs";
import AnalysisApp from "./components/AnalysisApp";

export default function Page() {
  return (
    <>
      {/* LOGGED OUT — LANDING PAGE */}
      <SignedOut>
        <LandingPage />
      </SignedOut>

      {/* LOGGED IN — APP ENTRY POINT */}
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  );
}

/**
 * Landing page for unauthenticated users
 */
function LandingPage() {
  return (
    <div style={styles.landingContainer}>
      {/* LOGO */}
      <Image
        src="/logo.png"
        alt="Bavella Technologies"
        width={120}
        height={120}
        priority
      />

      {/* TITLE */}
      <h1 style={styles.title}>Bavella Technologies</h1>

      {/* SUBTITLE */}
      <div style={styles.subtitle}>Quantitative Analytics</div>

      {/* ACTIONS */}
      <div style={styles.buttonGroup}>
        <SignInButton mode="modal">
          <button style={styles.signInButton}>Sign in</button>
        </SignInButton>

        <SignUpButton mode="modal">
          <button style={styles.signUpButton}>Create account</button>
        </SignUpButton>
      </div>
    </div>
  );
}

/**
 * Authenticated app wrapper - provides auth context to AnalysisApp
 */
function AuthenticatedApp() {
  const { getToken } = useAuth();

  /**
   * Authenticated fetch wrapper - automatically includes Clerk JWT
   */
  async function authFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);

    // Get fresh token from Clerk
    const token = await getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Set content-type for JSON bodies
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, { ...options, headers });
  }

  // AnalysisApp handles its own header/footer/UI
  return <AnalysisApp authFetch={authFetch} />;
}

/**
 * Styles
 */
const styles: Record<string, React.CSSProperties> = {
  // Landing Page
  landingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    textAlign: "center",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
    color: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.75,
  },
  buttonGroup: {
    display: "flex",
    gap: 12,
    marginTop: 24,
  },
  signInButton: {
    padding: "12px 24px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s",
  },
  signUpButton: {
    padding: "12px 24px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s",
  },
};
