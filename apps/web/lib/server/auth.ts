import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { NextRequest } from "next/server";
import { resolveCanonicalUserId } from "./user-identity-repository";

export type VerifiedIdentity = { userId: string; providerUserId: string; email: string; name: string; token: JWTPayload };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function requireIdentity(request: NextRequest): Promise<VerifiedIdentity> {
  const environmentId = process.env.DYNAMIC_ENVIRONMENT_ID ?? process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
  if (!environmentId) throw new AuthError(500, "Dynamic server verification is not configured");
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AuthError(401, "Authentication required");
  const token = authorization.slice(7);
  jwks ??= createRemoteJWKSet(new URL(`https://app.dynamic.xyz/api/v0/sdk/${environmentId}/.well-known/jwks`));
  try {
    const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"] });
    const tokenEnvironment = payload.environment_id ?? (payload.info as Record<string, unknown> | undefined)?.environmentId;
    if (tokenEnvironment !== environmentId) throw new AuthError(401, "Token belongs to another environment");
    const scopes = Array.isArray(payload.scopes) ? payload.scopes : typeof payload.scope === "string" ? payload.scope.split(" ") : [];
    if (scopes.includes("requiresAdditionalAuth")) throw new AuthError(403, "Additional authentication is required");
    if (!payload.sub || typeof payload.email !== "string" || !payload.email.trim()) throw new AuthError(403, "A verified email is required");
    const providerUserId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const name = [payload.given_name, payload.family_name].filter((value) => typeof value === "string").join(" ") || String(payload.alias ?? email.split("@")[0]);
    const userId = await resolveCanonicalUserId(providerUserId, email, name);
    return { userId, providerUserId, email, name, token: payload };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, "Invalid or expired authentication token");
  }
}

export class AuthError extends Error { constructor(public status: number, message: string) { super(message); } }
