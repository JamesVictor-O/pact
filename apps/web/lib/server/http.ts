import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function apiError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: "The request could not be completed" }, { status: 500 });
}
