import { NextRequest,NextResponse } from "next/server";
import { requireIdentity } from "../../../../lib/server/auth";
import { accessibleInvoice } from "../../../../lib/server/agreement-repository";
import { apiError } from "../../../../lib/server/http";
export async function GET(request:NextRequest,{params}:{params:Promise<{invoiceId:string}>}){try{const identity=await requireIdentity(request);const {invoiceId}=await params;const invoice=await accessibleInvoice(invoiceId,identity.userId,identity.email);return invoice?NextResponse.json({invoice}):NextResponse.json({error:"Invoice not found"},{status:404});}catch(error){return apiError(error);}}
