import { normalizeEmail } from "./agreements";
import type { ExpenseInput, ExpensePayment, ExpenseRecord, FundingSource, FundingSourceInput, NewPactEvent, PactEvent, PactUser } from "./pact-types";

const SESSION_KEY = "pact.preview.session.v1";
const EVENTS_KEY = "pact.preview.events.v1";
const FUNDING_SOURCES_KEY = "pact.funding-sources.v1";
const EXPENSE_RECORDS_KEY = "pact.expense-records.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix: string): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}_${id}`;
}

export interface AuthClient {
  getSession(): PactUser | null;
  establishSession(user: PactUser): PactUser;
  signInWithEmail(email: string): Promise<PactUser>;
  signInWithGoogle(): Promise<PactUser>;
  signOut(): Promise<void>;
}

class PreviewAuthClient implements AuthClient {
  getSession(): PactUser | null {
    return readJson<PactUser | null>(SESSION_KEY, null);
  }

  establishSession(user: PactUser): PactUser {
    writeJson(SESSION_KEY, user);
    return user;
  }

  async signInWithEmail(email: string): Promise<PactUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.getSession();
    const user: PactUser = existing?.email === normalizedEmail
      ? existing
      : {
          id: `user_${normalizedEmail}`,
          name: normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
        };

    writeJson(SESSION_KEY, user);
    return user;
  }

  async signInWithGoogle(): Promise<PactUser> {
    return this.signInWithEmail("organizer@pact.local");
  }

  async signOut(): Promise<void> {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export interface EventRepository {
  listByOwner(ownerId: string): PactEvent[];
  findById(eventId: string): PactEvent | null;
  create(ownerId: string, input: NewPactEvent): PactEvent;
}

export interface FundingRepository {
  listByEvent(eventId: string): FundingSource[];
  findById(sourceId: string): FundingSource | null;
  create(eventId: string, input: FundingSourceInput): FundingSource;
  update(sourceId: string, input: FundingSourceInput): FundingSource | null;
  cancel(sourceId: string): FundingSource | null;
}

export interface ExpenseRepository {
  listByEvent(eventId: string): ExpenseRecord[];
  findById(expenseId: string): ExpenseRecord | null;
  findPaymentById(paymentId: string): ExpenseRecord | null;
  create(eventId: string, input: ExpenseInput): ExpenseRecord;
  update(expenseId: string, input: ExpenseInput): ExpenseRecord | null;
  cancel(expenseId: string): ExpenseRecord | null;
}


class BrowserEventRepository implements EventRepository {
  private listAll(): PactEvent[] {
    return readJson<PactEvent[]>(EVENTS_KEY, []);
  }

  listByOwner(ownerId: string): PactEvent[] {
    return this.listAll()
      .filter((event) => event.ownerId === ownerId && (event.networkChainId ?? 10143) === Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? 143))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(eventId: string): PactEvent | null {
    return this.listAll().find((event) => event.id === eventId && (event.networkChainId ?? 10143) === Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? 143)) ?? null;
  }

  create(ownerId: string, input: NewPactEvent): PactEvent {
    const event: PactEvent = {
      ...input,
      id: createId("event"),
      networkChainId: Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? 143),
      ownerId,
      status: "active",
      vaultStatus: "not_started",
      createdAt: new Date().toISOString(),
    };

    writeJson(EVENTS_KEY, [...this.listAll(), event]);
    return event;
  }
}

class BrowserFundingRepository implements FundingRepository {
  private listAll(): FundingSource[] {
    return readJson<FundingSource[]>(FUNDING_SOURCES_KEY, []);
  }

  private saveAll(sources: FundingSource[]): void {
    writeJson(FUNDING_SOURCES_KEY, sources);
  }

  listByEvent(eventId: string): FundingSource[] {
    return this.listAll()
      .filter((source) => source.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(sourceId: string): FundingSource | null {
    return this.listAll().find((source) => source.id === sourceId) ?? null;
  }

  create(eventId: string, input: FundingSourceInput): FundingSource {
    const timestamp = new Date().toISOString();
    const source: FundingSource = {
      ...input,
      receivedAmount: input.receivedAmount ?? 0,
      id: createId("funding"),
      eventId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.saveAll([...this.listAll(), source]);
    return source;
  }

  update(sourceId: string, input: FundingSourceInput): FundingSource | null {
    let updated: FundingSource | null = null;
    const sources = this.listAll().map((source) => {
      if (source.id !== sourceId) return source;
      updated = { ...source, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    if (updated) this.saveAll(sources);
    return updated;
  }

  cancel(sourceId: string): FundingSource | null {
    let updated: FundingSource | null = null;
    const timestamp = new Date().toISOString();
    const sources = this.listAll().map((source) => {
      if (source.id !== sourceId) return source;
      updated = { ...source, cancelledAt: timestamp, updatedAt: timestamp };
      return updated;
    });
    if (updated) this.saveAll(sources);
    return updated;
  }
}

class BrowserExpenseRepository implements ExpenseRepository {
  private listAll(): ExpenseRecord[] { return readJson<ExpenseRecord[]>(EXPENSE_RECORDS_KEY, []); }
  private saveAll(records: ExpenseRecord[]): void { writeJson(EXPENSE_RECORDS_KEY, records); }

  listByEvent(eventId: string): ExpenseRecord[] {
    return this.listAll().filter((record) => record.expense.eventId === eventId).sort((a, b) => b.expense.createdAt.localeCompare(a.expense.createdAt));
  }

  findById(expenseId: string): ExpenseRecord | null {
    return this.listAll().find((record) => record.expense.id === expenseId) ?? null;
  }

  findPaymentById(paymentId: string): ExpenseRecord | null {
    return this.listAll().find((record) => record.payments.some((payment) => payment.id === paymentId)) ?? null;
  }

  create(eventId: string, input: ExpenseInput): ExpenseRecord {
    const timestamp = new Date().toISOString();
    const expenseId = createId("expense");
    const record: ExpenseRecord = {
      expense: { id: expenseId, eventId, title: input.title, category: input.category, payeeName: input.payeeName, payeeEmail: normalizeEmail(input.payeeEmail), vendorPayoutStatus: "missing", totalAmount: input.totalAmount, createdAt: timestamp, updatedAt: timestamp },
      payments: input.payments.map((payment): ExpensePayment => ({ ...payment, id: createId("payment"), expenseId, createdAt: timestamp, updatedAt: timestamp })),
    };
    this.saveAll([...this.listAll(), record]);
    return record;
  }

  update(expenseId: string, input: ExpenseInput): ExpenseRecord | null {
    let updated: ExpenseRecord | null = null;
    const timestamp = new Date().toISOString();
    const records = this.listAll().map((record) => {
      if (record.expense.id !== expenseId) return record;
      const existingById = new Map(record.payments.map((payment) => [payment.id, payment]));
      updated = {
        expense: { ...record.expense, title: input.title, category: input.category, payeeName: input.payeeName, payeeEmail: normalizeEmail(input.payeeEmail), vendorName: undefined, vendorEmail: undefined, totalAmount: input.totalAmount, updatedAt: timestamp },
        payments: input.payments.map((payment) => {
          const existing = payment.id ? existingById.get(payment.id) : undefined;
          return { ...payment, id: existing?.id ?? createId("payment"), expenseId, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
        }),
      };
      return updated;
    });
    if (updated) this.saveAll(records);
    return updated;
  }

  cancel(expenseId: string): ExpenseRecord | null {
    let updated: ExpenseRecord | null = null;
    const timestamp = new Date().toISOString();
    const records = this.listAll().map((record) => {
      if (record.expense.id !== expenseId) return record;
      updated = { ...record, expense: { ...record.expense, cancelledAt: timestamp, updatedAt: timestamp } };
      return updated;
    });
    if (updated) this.saveAll(records);
    return updated;
  }
}

export const isAuthPreviewEnabled =
  process.env.NEXT_PUBLIC_ENABLE_AUTH_PREVIEW === "true";

export const isDynamicAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
);

export const authClient: AuthClient = new PreviewAuthClient();
export const eventRepository: EventRepository = new BrowserEventRepository();
export const fundingRepository: FundingRepository = new BrowserFundingRepository();
export const expenseRepository: ExpenseRepository = new BrowserExpenseRepository();
