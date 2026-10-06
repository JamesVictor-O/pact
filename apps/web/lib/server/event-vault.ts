import "server-only";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalBytes32 } from "../agreement-typed-data";
import { database, transaction } from "./database";
import { mapEvent, type EventRow } from "./financial-repository";

const factoryAbi = parseAbi([
  "function createEventVault(bytes32 eventId,address organizer,uint64 deadline,bytes organizerSignature) returns(address)",
  "function eventVaults(bytes32 eventId) view returns(address)",
]);

function config() {
  const rpc = process.env.MONAD_RPC_URL;
  const factory = process.env.PACT_EVENT_VAULT_FACTORY_ADDRESS as Address | undefined;
  const key = process.env.PACT_RELAYER_PRIVATE_KEY as Hex | undefined;
  const chainId=Number(process.env.MONAD_CHAIN_ID);
  if (!rpc || !factory || !key || !Number.isSafeInteger(chainId)) throw new Error("Event vault relayer is not configured");
  return { rpc, factory, key, chainId };
}

export async function provisionEventVault(id: string, userId: string) {
  const configured=config();
  const claimed = await transaction(async (client) => {
    const result = await client.query<EventRow & {vault_authorization_signature:Buffer|null;vault_authorization_deadline:Date|null}>(`select * from events where id=$1 and owner_user_id=$2 and network_chain_id=$3 for update`, [id, userId, configured.chainId]);
    const row = result.rows[0];
    if (!row) return null;
    if (row.vault_status === "ready") return { row, ownsAttempt: false, transactionHash: row.vault_transaction_hash as Hex|undefined };
    if (!row.organizer_address || !row.vault_authorization_signature || !row.vault_authorization_deadline) throw new Error("Event vault authorization is incomplete");
    const inflight = await client.query<{status:string;transaction_hash:string|null;created_at:Date}>(`select status,transaction_hash,created_at from event_vault_attempts where event_id=$1 and status in ('submitting','submitted') order by attempt_number desc limit 1`, [id]);
    const attempt = inflight.rows[0];
    const stale = attempt?.status === "submitting" && !attempt.transaction_hash && Date.now() - attempt.created_at.getTime() > 120_000;
    if (stale) await client.query(`update event_vault_attempts set status='failed',failure_message='Relayer claim expired before submission',updated_at=now() where event_id=$1 and status='submitting'`, [id]);
    if (attempt?.status === "submitting" && !stale) return { row, ownsAttempt: false, transactionHash: undefined };
    if (attempt?.status === "submitted" && attempt.transaction_hash) return { row, ownsAttempt: true, transactionHash: attempt.transaction_hash as Hex };
    await client.query(`update events set vault_status='provisioning',vault_provisioning_claimed_at=now(),vault_error=null,updated_at=now() where id=$1`, [id]);
    await client.query(`insert into event_vault_attempts(event_id,attempt_number,status) select $1,coalesce(max(attempt_number),0)+1,'submitting' from event_vault_attempts where event_id=$1`, [id]);
    return { row, ownsAttempt: true, transactionHash: undefined };
  });
  if (!claimed) return null;
  if (claimed.row.vault_status === "ready") return mapEvent(claimed.row);
  if (!claimed.ownsAttempt) {
    const current = await database().query<EventRow>(`select * from events where id=$1 and owner_user_id=$2 and network_chain_id=$3`, [id, userId, configured.chainId]);
    return current.rows[0] ? mapEvent(current.rows[0]) : null;
  }
  try {
    const c = configured;
    const eventId = canonicalBytes32(id);
    const authorizationDeadline = claimed.row.vault_authorization_deadline;
    const authorizationSignature = claimed.row.vault_authorization_signature;
    if (!authorizationDeadline || !authorizationSignature) throw new Error("Event vault authorization is incomplete");
    const publicClient = createPublicClient({ transport: http(c.rpc) });
    const wallet = createWalletClient({ account: privateKeyToAccount(c.key), transport: http(c.rpc) });
    let transactionHash: Hex | undefined=claimed.transactionHash;
    if(transactionHash){const receipt=await publicClient.waitForTransactionReceipt({hash:transactionHash,confirmations:Number(process.env.MONAD_CONFIRMATIONS??1),timeout:120_000});if(receipt.status!=="success")throw new Error("Event vault transaction reverted");}
    let vault = await publicClient.readContract({ address: c.factory, abi: factoryAbi, functionName: "eventVaults", args: [eventId] });
    if (vault === "0x0000000000000000000000000000000000000000") {
      transactionHash = await wallet.writeContract({ chain: null, address: c.factory, abi: factoryAbi, functionName: "createEventVault", args: [eventId, claimed.row.organizer_address as Address, BigInt(Math.floor(authorizationDeadline.getTime() / 1000)), `0x${authorizationSignature.toString("hex")}` as Hex] });
      await database().query(`update event_vault_attempts set status='submitted',transaction_hash=$2,updated_at=now() where event_id=$1 and status='submitting'`, [id, transactionHash]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash, confirmations: Number(process.env.MONAD_CONFIRMATIONS ?? 1), timeout: 120_000 });
      if (receipt.status !== "success") throw new Error("Event vault transaction reverted");
      vault = await publicClient.readContract({ address: c.factory, abi: factoryAbi, functionName: "eventVaults", args: [eventId] });
    }
    if (vault === "0x0000000000000000000000000000000000000000") throw new Error("Factory did not create an event vault");
    const updated = await transaction(async (client) => {
      const result = await client.query<EventRow>(`update events set vault_address=$3,vault_factory_address=$4,vault_status='ready',vault_transaction_hash=coalesce($5,vault_transaction_hash),vault_error=null,updated_at=now() where id=$1 and owner_user_id=$2 returning *`, [id, userId, vault, c.factory, transactionHash ?? null]);
      await client.query(`update event_vault_attempts set status='confirmed',updated_at=now() where event_id=$1 and status in ('submitting','submitted')`, [id]);
      return result.rows[0];
    });
    return updated ? mapEvent(updated) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event vault provisioning failed";
    const result = await database().query<EventRow>(`update events set vault_status='retryable_failure',vault_error=$3,updated_at=now() where id=$1 and owner_user_id=$2 returning *`, [id, userId, message.slice(0, 500)]);
    await database().query(`update event_vault_attempts set status='failed',failure_message=$2,updated_at=now() where event_id=$1 and status in ('submitting','submitted')`, [id, message.slice(0, 500)]);
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }
}
