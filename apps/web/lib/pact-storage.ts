import { getPayeeEmail, getPayeeName, hashAgreementSnapshot, hashCanonical, hashSchedule, normalizeEmail } from "./agreements";
import type { AgreementSnapshot, ExpenseInput, ExpensePayment, ExpenseRecord, FundingSource, FundingSourceInput, Invoice, NewPactEvent, PactEvent, PactUser, Payee, PaymentAgreement, PayoutProfile } from "./pact-types";

const SESSION_KEY = "pact.preview.session.v1";
const EVENTS_KEY = "pact.preview.events.v1";
const FUNDING_SOURCES_KEY = "pact.funding-sources.v1";
const EXPENSE_RECORDS_KEY = "pact.expense-records.v1";
const PAYEES_KEY = "pact.payees.v1";
const AGREEMENTS_KEY = "pact.payment-agreements.v1";
const INVOICES_KEY = "pact.invoices.v1";
const PAYOUT_PROFILES_KEY = "pact.payout-profiles.v1";

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

export interface AgreementRepository {
  listForEmail(email: string): PaymentAgreement[];
  findById(id: string): PaymentAgreement | null;
  findByExpense(expenseId: string): PaymentAgreement | null;
  finalizeProposal(id: string, organizerAddress: string, signature: string): PaymentAgreement | null;
  accept(id: string, user: PactUser, signingAddress: string, signature: string): PaymentAgreement | null;
}
export interface InvoiceRepository { findById(id: string): Invoice | null; findByAgreement(agreementId: string): Invoice | null; confirm(id: string): Invoice | null; }
export interface PayoutRepository { findByUser(userId: string): PayoutProfile | null; verifyMera(userId: string, address: string): PayoutProfile; }

class BrowserEventRepository implements EventRepository {
  private listAll(): PactEvent[] {
    return readJson<PactEvent[]>(EVENTS_KEY, []);
  }

  listByOwner(ownerId: string): PactEvent[] {
    return this.listAll()
      .filter((event) => event.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(eventId: string): PactEvent | null {
    return this.listAll().find((event) => event.id === eventId) ?? null;
  }

  create(ownerId: string, input: NewPactEvent): PactEvent {
    const event: PactEvent = {
      ...input,
      id: createId("event"),
      ownerId,
      status: "active",
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
    createAgreementBundle(record);
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

function listPayees(): Payee[] { return readJson<Payee[]>(PAYEES_KEY, []); }
function listAgreements(): PaymentAgreement[] { return readJson<PaymentAgreement[]>(AGREEMENTS_KEY, []); }
function listInvoices(): Invoice[] { return readJson<Invoice[]>(INVOICES_KEY, []); }

function createAgreementBundle(record: ExpenseRecord): void {
  const event = eventRepository.findById(record.expense.eventId);
  const organizer = authClient.getSession();
  if (!event || !organizer) return;
  const now = new Date().toISOString();
  const email = getPayeeEmail(record.expense);
  const payees = listPayees();
  let payee = payees.find((item) => item.eventId === event.id && item.email === email);
  if (!payee) {
    payee = { id: createId("payee"), eventId: event.id, name: getPayeeName(record.expense), email, createdAt: now, updatedAt: now };
    writeJson(PAYEES_KEY, [...payees, payee]);
  }
  const agreementId = createId("agreement");
  const snapshot: AgreementSnapshot = {
    agreementId, eventId: event.id, eventName: event.name, organizerUserId: organizer.id, organizerDisplayName: organizer.name,
    expenseId: record.expense.id, title: record.expense.title, category: record.expense.category, payeeName: payee.name, payeeEmail: payee.email,
    totalAmountMinor: Math.round(record.expense.totalAmount * 100), currency: event.displayCurrency,
    paymentSchedule: record.payments.map((payment) => ({ paymentId: payment.id, label: payment.label, amountMinor: Math.round(payment.amount * 100), dueDate: payment.dueDate })),
    termsVersion: "2026-09-30.v1", terms: "By accepting, you agree to the service description, total amount, and payment schedule shown in this agreement.",
  };
  const agreement: PaymentAgreement = {
    id: agreementId, eventId: event.id, expenseId: record.expense.id, organizerUserId: organizer.id, payeeId: payee.id, payeeEmail: payee.email,
    totalAmountMinor: snapshot.totalAmountMinor, currency: event.displayCurrency, status: "draft", snapshot,
    agreementHash: hashAgreementSnapshot(snapshot), scheduleHash: hashSchedule(snapshot), registrationStatus: "not_started", createdAt: now, updatedAt: now,
  };
  const invoiceId = createId("invoice");
  const invoiceSnapshot = { invoiceNumber: `PACT-${invoiceId.slice(-6).toUpperCase()}`, direction: "payable" as const, issuerName: payee.name, issuerEmail: payee.email, recipientName: event.name, recipientEmail: organizer.email, description: record.expense.title, amountMinor: snapshot.totalAmountMinor, currency: event.displayCurrency, agreementReference: agreementId, schedule: snapshot.paymentSchedule, issuedOn: now.slice(0, 10) };
  const invoice: Invoice = { id: invoiceId, eventId: event.id, direction: "payable", agreementId, invoiceNumber: invoiceSnapshot.invoiceNumber, snapshot: invoiceSnapshot, amountMinor: snapshot.totalAmountMinor, currency: event.displayCurrency, status: "prepared", documentHash: hashCanonical(invoiceSnapshot), createdAt: now, updatedAt: now };
  writeJson(AGREEMENTS_KEY, [...listAgreements(), agreement]);
  writeJson(INVOICES_KEY, [...listInvoices(), invoice]);
}

class BrowserAgreementRepository implements AgreementRepository {
  listForEmail(email: string) { const normalized = normalizeEmail(email); return listAgreements().filter((item) => item.payeeEmail === normalized); }
  findById(id: string) { return listAgreements().find((item) => item.id === id) ?? null; }
  findByExpense(expenseId: string) { return listAgreements().find((item) => item.expenseId === expenseId) ?? null; }
  finalizeProposal(id: string, organizerAddress: string, signature: string) { let result: PaymentAgreement | null = null; const now = new Date().toISOString(); const agreements = listAgreements().map((item) => { if (item.id !== id || item.status !== "draft") return item; result = { ...item, organizerAddress, organizerSignature: signature, status: "awaiting_acceptance", updatedAt: now }; return result; }); if (result) writeJson(AGREEMENTS_KEY, agreements); return result; }
  accept(id: string, user: PactUser, signingAddress: string, signature: string) {
    let result: PaymentAgreement | null = null; const now = new Date().toISOString();
    const agreements = listAgreements().map((item) => {
      if (item.id !== id || item.payeeEmail !== normalizeEmail(user.email) || item.status !== "awaiting_acceptance") return item;
      result = { ...item, payeeUserId: user.id, payeeAddress: signingAddress, payeeSignature: signature, status: "active", registrationStatus: "acceptance_signed", acceptedAt: now, updatedAt: now }; return result;
    });
    if (result) writeJson(AGREEMENTS_KEY, agreements); return result;
  }
}
class BrowserInvoiceRepository implements InvoiceRepository {
  findById(id: string) { return listInvoices().find((item) => item.id === id) ?? null; }
  findByAgreement(agreementId: string) { return listInvoices().find((item) => item.agreementId === agreementId) ?? null; }
  confirm(id: string) { let result: Invoice | null = null; const now = new Date().toISOString(); const invoices = listInvoices().map((item) => { if (item.id !== id) return item; result = { ...item, status: "confirmed", confirmedAt: now, updatedAt: now }; return result; }); if (result) writeJson(INVOICES_KEY, invoices); return result; }
}
class BrowserPayoutRepository implements PayoutRepository {
  findByUser(userId: string) { return readJson<PayoutProfile[]>(PAYOUT_PROFILES_KEY, []).find((item) => item.userId === userId) ?? null; }
  verifyMera(userId: string, address: string) { const profile: PayoutProfile = { userId, signingAddress: address, payoutType: "mera", payoutAddress: address, verificationStatus: "verified", verifiedAt: new Date().toISOString() }; const profiles = readJson<PayoutProfile[]>(PAYOUT_PROFILES_KEY, []).filter((item) => item.userId !== userId); writeJson(PAYOUT_PROFILES_KEY, [...profiles, profile]); return profile; }
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
export const agreementRepository: AgreementRepository = new BrowserAgreementRepository();
export const invoiceRepository: InvoiceRepository = new BrowserInvoiceRepository();
export const payoutRepository: PayoutRepository = new BrowserPayoutRepository();
