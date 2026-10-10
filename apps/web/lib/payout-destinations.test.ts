import assert from "node:assert/strict";
import test from "node:test";
import {isValidPayoutAddress,payoutChainFamily} from "./payout-destinations.ts";

test("classifies supported payout address families",()=>{
  assert.equal(payoutChainFamily("base"),"evm");
  assert.equal(payoutChainFamily("arb"),"evm");
  assert.equal(payoutChainFamily("eth"),"evm");
  assert.equal(payoutChainFamily("op"),"evm");
  assert.equal(payoutChainFamily("pol"),"evm");
  assert.equal(payoutChainFamily("solana"),"solana");
  assert.equal(payoutChainFamily("sol"),"solana");
  assert.equal(payoutChainFamily("stellar"),"stellar");
});

test("validates addresses using the selected destination network",()=>{
  assert.equal(isValidPayoutAddress("base","0x2e5d8B56F9B4770a88794a47C32c177542d2f6ea"),true);
  assert.equal(isValidPayoutAddress("base","GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK"),false);
  assert.equal(isValidPayoutAddress("stellar","GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK"),true);
  assert.equal(isValidPayoutAddress("solana","11111111111111111111111111111111"),true);
});
