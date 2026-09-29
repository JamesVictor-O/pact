"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePactAuth } from "./PactAuthProvider";

export default function AppTopbar({ userName, compact = false }: { userName?: string; compact?: boolean }) {
  const router = useRouter();
  const { signOut: endSession } = usePactAuth();

  async function signOut() {
    await endSession();
    router.replace("/auth");
  }

  return <header className={`app-topbar${compact ? " app-topbar-compact" : ""}`}>
    <Link className="app-wordmark" href="/" aria-label="Pact home"><Image src="/pact-primary-logo.svg" alt="Pact" width={112} height={34} priority /></Link>
    {userName && <div className="app-user"><span>{userName}</span><button type="button" onClick={signOut}><LogOut aria-hidden="true" /> Sign out</button></div>}
  </header>;
}
