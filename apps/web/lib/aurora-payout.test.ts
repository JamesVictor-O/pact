import assert from "node:assert/strict";
import test from "node:test";
import {filterSupportedPayoutAssets} from "./aurora-payout-options.ts";

test("offers only unique USDC payout destinations and excludes Monad origin",()=>{
  const assets=filterSupportedPayoutAssets([
    {assetId:"monad-usdc",blockchain:"monad",symbol:"USDC",decimals:6},
    {assetId:"base-usdc",blockchain:"base",symbol:"USDC",decimals:6},
    {assetId:"base-usdc",blockchain:"base",symbol:"USDC",decimals:6},
    {assetId:"base-eth",blockchain:"base",symbol:"ETH",decimals:18},
    {assetId:"sol-usdc",blockchain:"solana",symbol:"usdc",decimals:6},
  ],"monad-usdc");
  assert.deepEqual(assets.map(asset=>asset.assetId),["base-usdc","sol-usdc"]);
});
