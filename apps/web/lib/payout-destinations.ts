import {isAddress} from "viem";

const EVM_CHAINS=new Set(["arb","arbitrum","aurora","avax","avalanche","base","bsc","eth","ethereum","gnosis","hypercore","linea","mantle","monad","op","optimism","pol","polygon","scroll","xlayer","zksync"]);
const BASE58=/^[1-9A-HJ-NP-Za-km-z]+$/;
const CHAIN_LABELS:Record<string,string>={arb:"Arbitrum",avax:"Avalanche",eth:"Ethereum",op:"Optimism",pol:"Polygon",sol:"Solana",bsc:"BNB Chain",near:"NEAR",stellar:"Stellar",sui:"Sui",aptos:"Aptos",gnosis:"Gnosis",base:"Base",xlayer:"X Layer",hypercore:"Hyperliquid"};

export function payoutChainLabel(chain:string){
  const normalized=chain.trim().toLowerCase();
  return CHAIN_LABELS[normalized]??chain.replace(/[_-]+/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());
}

export function payoutChainFamily(chain:string){
  const normalized=chain.trim().toLowerCase();
  if(EVM_CHAINS.has(normalized))return "evm";
  if(normalized==="sol"||normalized.includes("solana"))return "solana";
  if(normalized.includes("stellar"))return "stellar";
  if(normalized.includes("near"))return "near";
  return "other";
}

export function isValidPayoutAddress(chain:string,address:string){
  const value=address.trim(),family=payoutChainFamily(chain);
  if(family==="evm")return isAddress(value);
  if(family==="solana")return value.length>=32&&value.length<=44&&BASE58.test(value);
  if(family==="stellar")return /^G[A-Z2-7]{55}$/.test(value);
  if(family==="near")return /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
  return value.length>=3&&value.length<=128&&!/\s/.test(value);
}
