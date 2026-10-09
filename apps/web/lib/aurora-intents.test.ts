import assert from "node:assert/strict";
import test from "node:test";
import { observationBelongsToRoute } from "./aurora-observations.ts";
import { chainFamily, transactionBelongsToRoute } from "./aurora-transactions.ts";

const route={depositChain:"stellar" as const,depositAddress:"G-STELLAR",destinationChain:"monad",destinationAsset:"monad-usdc",recipientAddress:"0xEventVault",createdAt:new Date("2026-10-09T20:45:15.475Z")};
const observation={tx_hash:"0xabc",fromChain:null,destinationChain:"monad",asset_id:"monad-usdc",created_at:"2026-10-09T20:46:00.000Z",deposit_address:"G-STELLAR",recipient:"0xeventvault"};

test("accepts a settlement observation for the exact route",()=>{
  assert.equal(observationBelongsToRoute(observation,"success",route),true);
});

test("rejects historical observations returned for a reused Stellar address",()=>{
  assert.equal(observationBelongsToRoute({...observation,created_at:"2026-08-04T02:58:33.193Z"},"success",route),false);
});

test("rejects another route's destination even when the deposit address is shared",()=>{
  assert.equal(observationBelongsToRoute({...observation,destinationChain:"base",asset_id:"base-usdc",recipient:"0xSomeoneElse"},"success",route),false);
});

const historyTransaction={originAsset:"stellar-xlm",destinationAsset:"monad-usdc",depositAddress:"internal-intents-id",depositMemo:null,depositAddressAndMemo:"internal-intents-id",recipient:"0xEventVault",status:"SUCCESS" as const,createdAt:"2026-10-09T21:59:30.185Z",intentHashes:"intent",originChainTxHashes:[],destinationChainTxHashes:["0xdestination"],amountIn:"11000000",amountOut:"212437",senders:[]};

test("normalizes supported source networks into routing families",()=>{
  assert.equal(chainFamily("arbitrum"),"evm");
  assert.equal(chainFamily("base"),"evm");
  assert.equal(chainFamily("solana"),"sol");
  assert.equal(chainFamily("stellar"),"stellar");
});

test("matches normalized transaction history without assuming an EVM source hash",()=>{
  assert.equal(transactionBelongsToRoute(historyTransaction,route,"stellar"),true);
});

test("rejects history from the wrong source family or destination asset",()=>{
  assert.equal(transactionBelongsToRoute(historyTransaction,route,"solana"),false);
  assert.equal(transactionBelongsToRoute({...historyTransaction,destinationAsset:"other"},route,"stellar"),false);
});

test("requires a matching memo when Aurora exposes the public deposit identity",()=>{
  const publicHistory={...historyTransaction,depositAddress:route.depositAddress,depositMemo:"wrong"};
  assert.equal(transactionBelongsToRoute(publicHistory,{...route,depositMemo:"195835458"},"stellar"),false);
});

test("matches a new Stellar source observation but rejects another source family",()=>{
  const received={...observation,fromChain:"stellar",destinationChain:null,asset_id:"stellar-usdc"};
  assert.equal(observationBelongsToRoute(received,"received",route),true);
  assert.equal(observationBelongsToRoute({...received,fromChain:"sol"},"received",route),false);
});
