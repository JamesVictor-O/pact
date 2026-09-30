import type { Metadata } from "next";
import AuthEntry from "./AuthEntry";

export const metadata: Metadata = { title: "Continue" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  return <AuthEntry intent={intent === "payee" ? "payee" : "organizer"} />;
}
