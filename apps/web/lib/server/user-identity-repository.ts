import "server-only";
import type { QueryResultRow } from "pg";
import { transaction } from "./database";

type UserRow = QueryResultRow & { id: string };
type IdentityRow = QueryResultRow & { user_id: string };

export async function resolveCanonicalUserId(subject: string, email: string, name: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  return transaction(async client => {
    const knownIdentity = await client.query<IdentityRow>(
      `select user_id from dynamic_identities where subject=$1 for update`,
      [subject],
    );
    if (knownIdentity.rows[0]) {
      await client.query(
        `update dynamic_identities set last_seen_at=now() where subject=$1`,
        [subject],
      );
      return knownIdentity.rows[0].user_id;
    }

    const user = await client.query<UserRow>(
      `insert into pact_users(id,normalized_email,display_name)
       values($1,$2,$3)
       on conflict(normalized_email) do update
       set display_name=excluded.display_name,updated_at=now()
       returning id`,
      [subject, normalizedEmail, name],
    );
    const canonicalUserId = user.rows[0]!.id;

    await client.query(
      `insert into dynamic_identities(subject,user_id,last_seen_at)
       values($1,$2,now())
       on conflict(subject) do update set last_seen_at=now()`,
      [subject, canonicalUserId],
    );
    const linkedIdentity = await client.query<IdentityRow>(
      `select user_id from dynamic_identities where subject=$1`,
      [subject],
    );
    return linkedIdentity.rows[0]!.user_id;
  });
}
