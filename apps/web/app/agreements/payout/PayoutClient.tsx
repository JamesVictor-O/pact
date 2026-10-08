"use client";

import { CheckCircle2,Copy,ShieldCheck,WalletCards } from "lucide-react";
import { useState } from "react";
import { PayeeWorkspaceChrome,PayeeWorkspaceError,PayeeWorkspaceLoading,usePayeeWorkspace } from "../PayeeWorkspace";

const titleCase=(value:string)=>value.replace(/[_-]+/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default function PayoutClient(){
  const{data,error,retry}=usePayeeWorkspace();const[copied,setCopied]=useState(false);
  if(!data&&!error)return <PayeeWorkspaceChrome><PayeeWorkspaceLoading/></PayeeWorkspaceChrome>;
  if(!data)return <PayeeWorkspaceChrome><PayeeWorkspaceError message={error} retry={retry}/></PayeeWorkspaceChrome>;
  const payout=data.payout;async function copy(){if(!payout)return;await navigator.clipboard.writeText(payout.destinationAddress);setCopied(true);window.setTimeout(()=>setCopied(false),1600);}
  return <PayeeWorkspaceChrome><div className="payee-workspace"><header className="payee-heading"><div><p className="app-eyebrow">Receiving account</p><h1>Your payout</h1><p>Review where Pact will deliver payments from your active agreements.</p></div></header>{payout?<><section className="payee-payout-card"><span className="payee-payout-icon"><WalletCards aria-hidden="true"/></span><div><span className="payee-verified"><CheckCircle2 aria-hidden="true"/>Verified</span><p>Payments arrive as</p><h2>{payout.destinationAssetSymbol} on {titleCase(payout.destinationChain)}</h2><small>{payout.payoutType==="mera"?"Your passkey-secured Pact account":"Your verified external destination"}</small></div><button className="app-secondary-button" type="button" onClick={copy}><Copy aria-hidden="true"/>{copied?"Copied":"Copy address"}</button><code title={payout.destinationAddress}>{payout.destinationAddress}</code></section><section className="payee-payout-note"><ShieldCheck aria-hidden="true"/><div><h2>Used for your Pact payments</h2><p>This destination is linked to your verified identity and applies when an organizer releases a scheduled payment. Pact keeps payment status separate from the agreement amount, so you can see when value is expected, processing, or delivered.</p></div></section></>:<section className="payee-state"><WalletCards aria-hidden="true"/><h2>No payout destination yet</h2><p>Your payout destination is created or verified when you accept your first agreement.</p></section>}</div></PayeeWorkspaceChrome>;
}
