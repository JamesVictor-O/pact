"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { useCallback,useEffect,useState,type ReactNode } from "react";
import { FileCheck2,LayoutDashboard,LogOut,ReceiptText,WalletCards } from "lucide-react";
import { getPayeeWorkspace } from "../../lib/agreement-api";
import type { PayeeWorkspace } from "../../lib/pact-types";
import { usePactAuth } from "../components/PactAuthProvider";

const navigation=[{href:"/agreements",label:"Overview",icon:LayoutDashboard},{href:"/agreements/payments",label:"Payments",icon:ReceiptText},{href:"/agreements/payout",label:"Payout",icon:WalletCards}];

export function usePayeeWorkspace(){
  const router=useRouter();const{ready,user}=usePactAuth();const[data,setData]=useState<PayeeWorkspace|null>(null);const[error,setError]=useState("");
  const load=useCallback(async()=>{setError("");try{setData(await getPayeeWorkspace());}catch{setError("We couldn’t load your payee workspace. Try again.");}},[]);
  useEffect(()=>{if(!ready)return;if(!user){router.replace("/auth?intent=payee");return;}void load();},[ready,user?.id,router,load]);
  return{data,error,retry:load,user};
}

export function PayeeWorkspaceChrome({children}:{children:ReactNode}){
  const pathname=usePathname();const router=useRouter();const{user,signOut}=usePactAuth();
  async function leave(){await signOut();router.replace("/");}
  return <main className="payee-shell"><header className="payee-topbar"><Link className="payee-logo" href="/agreements"><Image src="/pact-primary-logo.svg" alt="Pact" width={104} height={32}/></Link><nav aria-label="Payee workspace">{navigation.map(({href,label,icon:Icon})=><Link href={href} className={pathname===href?"active":""} aria-current={pathname===href?"page":undefined} key={href}><Icon aria-hidden="true"/>{label}</Link>)}</nav><div className="payee-account"><span>{user?.email}</span><button type="button" onClick={leave}><LogOut aria-hidden="true"/><span>Sign out</span></button></div></header>{children}</main>;
}

export function PayeeWorkspaceLoading(){return <div className="payee-workspace payee-workspace-loading" aria-label="Loading your workspace"><div className="payee-skeleton-heading"/><div className="payee-skeleton-grid">{Array.from({length:3},(_,index)=><span key={index}/>)}</div><div className="payee-skeleton-list"/></div>}

export function PayeeWorkspaceError({message,retry}:{message:string;retry:()=>void}){return <div className="payee-workspace"><section className="payee-state" role="alert"><FileCheck2 aria-hidden="true"/><h1>Workspace unavailable</h1><p>{message}</p><button className="app-secondary-button" type="button" onClick={retry}>Try again</button></section></div>}
