import type { Metadata } from "next";
import AuthEntry from "./AuthEntry";

export const metadata: Metadata = { title: "Continue" };

export default function AuthPage() {
  return <AuthEntry />;
}
