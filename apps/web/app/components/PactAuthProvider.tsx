"use client";

import {
  DynamicContextProvider,
  useConnectWithOtp,
  useDynamicContext,
  type UserProfile,
} from "@dynamic-labs/sdk-react-core";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { authClient, isAuthPreviewEnabled, isDynamicAuthConfigured } from "../../lib/pact-storage";
import type { PactUser } from "../../lib/pact-types";

type PactAuthContextValue = {
  configured: boolean;
  ready: boolean;
  user: PactUser | null;
  openAuth: () => void;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const PactAuthContext = createContext<PactAuthContextValue>({
  configured: false,
  ready: true,
  user: null,
  openAuth: () => undefined,
  sendEmailCode: async () => undefined,
  verifyEmailCode: async () => undefined,
  signOut: () => authClient.signOut(),
});

function toPactUser(user: UserProfile): PactUser {
  const email = user.email?.trim().toLowerCase() ?? "";
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.alias || email.split("@")[0] || "Organizer";

  return {
    id: `dynamic_${user.userId ?? user.sessionId}`,
    name: displayName,
    email,
    createdAt: new Date().toISOString(),
  };
}

function DynamicAuthBridge({ children }: { children: ReactNode }) {
  const { user: dynamicUser, sdkHasLoaded, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const { connectWithEmail, verifyOneTimePassword } = useConnectWithOtp();
  const pactUser = useMemo(() => dynamicUser ? toPactUser(dynamicUser) : null, [dynamicUser?.userId, dynamicUser?.sessionId, dynamicUser?.email, dynamicUser?.firstName, dynamicUser?.lastName, dynamicUser?.alias]);

  useEffect(() => {
    if (pactUser) authClient.establishSession(pactUser);
    else if (sdkHasLoaded) void authClient.signOut();
  }, [pactUser?.id, sdkHasLoaded]);

  return <PactAuthContext.Provider value={{
    configured: true,
    ready: sdkHasLoaded,
    user: pactUser,
    openAuth: () => setShowAuthFlow(true),
    sendEmailCode: connectWithEmail,
    verifyEmailCode: async (code) => { await verifyOneTimePassword(code); },
    signOut: async () => {
      await handleLogOut();
      await authClient.signOut();
    },
  }}>{children}</PactAuthContext.Provider>;
}

function PreviewAuthBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isAuthPreviewEnabled) void authClient.signOut();
  }, []);

  return <PactAuthContext.Provider value={{
    configured: isAuthPreviewEnabled,
    ready: true,
    user: isAuthPreviewEnabled ? authClient.getSession() : null,
    openAuth: () => undefined,
    sendEmailCode: async (email) => { await authClient.signInWithEmail(email); },
    verifyEmailCode: async () => undefined,
    signOut: () => authClient.signOut(),
  }}>{children}</PactAuthContext.Provider>;
}

export default function PactAuthProvider({ children }: { children: ReactNode }) {
  const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

  if (!isDynamicAuthConfigured || !environmentId) return <PreviewAuthBridge>{children}</PreviewAuthBridge>;

  return <DynamicContextProvider theme="light" settings={{
    environmentId,
    appName: "Pact",
    appLogoUrl: "/pact-icon.svg",
    social: { strategy: "popup" },
  }}><DynamicAuthBridge>{children}</DynamicAuthBridge></DynamicContextProvider>;
}

export function usePactAuth() {
  return useContext(PactAuthContext);
}
