import assert from "node:assert/strict";
import test from "node:test";
import { AuroraHttpError, requestAurora } from "./aurora-http.ts";

test("Aurora HTTP client honours Retry-After before retrying",async()=>{let calls=0;const waits:number[]=[];const fetcher=(async()=>{calls++;return calls===1?new Response(JSON.stringify({message:"Rate limit exceeded"}),{status:429,headers:{"content-type":"application/json","retry-after":"2"}}):Response.json({depositAddress:"0xabc",alreadyExists:false});}) as typeof fetch;const result=await requestAurora<{depositAddress:string}>({url:"https://example.test",fetcher,sleep:async milliseconds=>{waits.push(milliseconds);}});assert.equal(result.depositAddress,"0xabc");assert.equal(calls,2);assert.deepEqual(waits,[2000]);});

test("Aurora HTTP client preserves upstream status and correlation id",async()=>{const fetcher=(async()=>new Response(JSON.stringify({message:"Organisation approval required",correlationId:"trace-123"}),{status:403,headers:{"content-type":"application/json"}})) as typeof fetch;await assert.rejects(()=>requestAurora({url:"https://example.test",fetcher,maxAttempts:1}),error=>error instanceof AuroraHttpError&&error.status===403&&error.correlationId==="trace-123");});

test("Aurora HTTP client converts terminal network failure to 502",async()=>{const fetcher=(async()=>{throw new Error("network unavailable")}) as typeof fetch;await assert.rejects(()=>requestAurora({url:"https://example.test",fetcher,maxAttempts:1}),error=>error instanceof AuroraHttpError&&error.status===502);});
