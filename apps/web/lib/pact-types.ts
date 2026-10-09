export const DISPLAY_CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export const EVENT_TYPES = [
  "Conference",
  "Community Event",
  "Concert",
  "Corporate Event",
  "Creator Event",
  "Wedding",
  "Other",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export const FUNDING_SOURCE_TYPES = [
  "organizer",
  "sponsor",
  "donor",
  "partner",
  "ticket_revenue",
  "grant",
  "other",
] as const;

export type FundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];
export type FundingSourceStatus = "expected" | "partially_received" | "received" | "overdue" | "cancelled" | "open";

export const EXPENSE_CATEGORIES = ["venue", "production", "catering", "security", "travel", "media", "equipment", "contractor", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = "unfunded" | "partially_funded" | "funded" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type ExpensePaymentStatus = "unfunded" | "partially_funded" | "funded" | "paid" | "overdue" | "cancelled";
export type VendorPayoutStatus = "missing" | "pending" | "verified";
export type AgreementStatus = "draft" | "awaiting_acceptance" | "acceptance_signed" | "registration_pending" | "active" | "declined" | "cancelled" | "completed";
export type InvoiceStatus = "prepared" | "issued" | "confirmed" | "paid" | "voided";
export type PaymentOperationalStatus = "needs_funding" | "partially_funded" | "payout_setup_needed" | "ready_to_pay" | "overdue" | "processing" | "paid" | "cancelled";

export interface PactUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PactEvent {
  id: string;
  networkChainId: number;
  ownerId: string;
  name: string;
  date: string;
  estimatedBudget: number;
  displayCurrency: DisplayCurrency;
  eventType?: EventType;
  status: "active";
  organizerAddress?: string;
  vaultAddress?: string;
  vaultFactoryAddress?: string;
  vaultStatus: "not_started" | "provisioning" | "ready" | "retryable_failure";
  vaultTransactionHash?: string;
  vaultError?: string;
  createdAt: string;
}

export type NewPactEvent = Pick<
  PactEvent,
  "name" | "date" | "estimatedBudget" | "displayCurrency" | "eventType"
>;

export type EventVaultAuthorization = {
  eventId: string;
  organizer: `0x${string}`;
  deadline: string;
  signature: `0x${string}`;
};

export type CreatePactEventInput = NewPactEvent & { id: string; vaultAuthorization: EventVaultAuthorization };

export interface FundingSource {
  id: string;
  eventId: string;
  type: FundingSourceType;
  name: string;
  committedAmount: number;
  receivedAmount: number;
  allocatedAmount?: number;
  openContributions?: boolean;
  expectedDate?: string;
  notes?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FundingSourceInput = Pick<
  FundingSource,
  "type" | "name" | "committedAmount" | "expectedDate" | "notes"
> & { /** Legacy import only. Interactive flows cannot assert receipt. */ receivedAmount?: number };

export type FundingRequestStatus = "draft" | "sent" | "routing" | "received" | "partially_allocated" | "allocated" | "refunded" | "cancelled" | "failed";
export interface FundingRequest {
  id: string; eventId: string; fundingSourceId: string; publicSlug: string; amount: number; currency: DisplayCurrency;
  requestKind?: "requested" | "public_contribution";
  status: FundingRequestStatus; onchainRequestId?: string; expiresAt?: string; sentAt?: string; createdAt: string; updatedAt: string;
}

export interface PublicContributionPage {
  eventId:string;fundingSourceId:string;fundingRequestId:string;publicSlug:string;enabled:boolean;receivedAmount:number;createdAt:string;updatedAt:string;
}

export interface FundingReceipt {
  id: string; fundingRequestId: string; eventId: string; contributorAddress: string; settlementTokenAddress: string;
  amountAtomic: string; amount: number; chainId: number; transactionHash: string; blockNumber: number;
  status: "confirming" | "confirmed" | "reorged" | "refunded"; confirmedAt?: string; createdAt: string;
}

export type AuroraDepositChain = "evm" | "btc" | "sol" | "tron" | "near" | "stellar";
export type AuroraRouteStatus = "ready" | "deposit_received" | "processing" | "success" | "failed";
export interface AuroraDepositRoute {
  id:string;fundingRequestId:string;eventId:string;depositChain:AuroraDepositChain;depositAddress:string;depositMemo?:string;
  destinationChain:string;destinationAsset:string;recipientAddress:string;status:AuroraRouteStatus;lastError?:string;lastSyncedAt?:string;createdAt:string;updatedAt:string;
}

export interface PaymentSettlement {
  id: string; eventId: string; agreementId: string; paymentId: string; payoutAddress: string; settlementTokenAddress: string;
  amountAtomic: string; amount: number; transactionHash?: string; status: "authorization_signed" | "submitted" | "confirmed" | "routing" | "delivered" | "refunded" | "failed";
  settlementMode?: "direct" | "aurora"; payoutRouteQuoteId?: string;
  failureMessage?: string; confirmedAt?: string; createdAt: string;
}

export type VaultExecutionChallenge = {
  vaultAddress: `0x${string}`;
  organizer: `0x${string}`;
  agreementId: string;
  paymentId: string;
  amount: number;
  amountAtomic: string;
  nonce: string;
  deadline: string;
  payoutAddress?: `0x${string}`;
  payoutRouteQuoteId?: string;
  settlementMode?: "direct" | "aurora";
  destinationChain?: string;
  destinationAssetSymbol?: string;
  expectedOutput?: string;
  minimumOutput?: string;
};

export type VaultExecutionAuthorization = VaultExecutionChallenge & { signature: `0x${string}` };

export interface Expense {
  id: string;
  eventId: string;
  title: string;
  category: ExpenseCategory;
  payeeName?: string;
  payeeEmail?: string;
  /** Legacy read compatibility. New records only write payee fields. */
  vendorName?: string;
  vendorEmail?: string;
  vendorPayoutStatus?: VendorPayoutStatus;
  totalAmount: number;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payee {
  id: string; eventId: string; name: string; email: string; userId?: string; createdAt: string; updatedAt: string;
}

export interface AgreementScheduleItem { paymentId: string; label: string; amountMinor: number; dueDate?: string; }
export interface AgreementSnapshot {
  agreementId: string; eventId: string; eventName: string; organizerUserId: string; organizerDisplayName: string;
  expenseId: string; title: string; category: ExpenseCategory; payeeName: string; payeeEmail: string;
  totalAmountMinor: number; currency: DisplayCurrency; paymentSchedule: AgreementScheduleItem[];
  termsVersion: string; terms: string;
}

export interface PaymentAgreement {
  id: string; eventId: string; expenseId: string; organizerUserId: string; payeeId: string; payeeEmail: string; payeeUserId?: string;
  totalAmountMinor: number; currency: DisplayCurrency; status: AgreementStatus; snapshot: AgreementSnapshot;
  agreementHash: string; scheduleHash: string; organizerAddress?: string; payeeAddress?: string;
  organizerSignature?: string; payeeSignature?: string; onchainAgreementId?: string; onchainTxHash?: string;
  registrationStatus: "not_started" | "acceptance_signed" | "pending" | "registered" | "retryable_failure";
  proposalExpiresAt?: string; registrationError?: string;
  acceptedAt?: string; declinedAt?: string; cancelledAt?: string; createdAt: string; updatedAt: string;
}

export interface InvoiceSnapshot {
  invoiceNumber: string; direction: "receivable" | "payable"; issuerName: string; issuerEmail?: string;
  recipientName: string; recipientEmail?: string; description: string; amountMinor: number; currency: DisplayCurrency;
  agreementReference?: string; schedule: AgreementScheduleItem[]; issuedOn: string;
}

export interface Invoice {
  id: string; eventId: string; direction: "receivable" | "payable"; fundingSourceId?: string; agreementId?: string;
  invoiceNumber: string; snapshot: InvoiceSnapshot; amountMinor: number; currency: DisplayCurrency; status: InvoiceStatus;
  documentHash: string; confirmedAt?: string; paidAt?: string; createdAt: string; updatedAt: string;
}

export interface PayoutProfile {
  userId: string; signingAddress: string; payoutType: "mera" | "external_wallet"; payoutAddress: string;
  verificationStatus: "pending" | "verified"; verifiedAt?: string;
  destinationChain: string; destinationAssetId: string; destinationAssetSymbol: string; destinationAssetDecimals: number;
  destinationAddress: string; destinationVerification: "pact_account" | "wallet_signature" | "payee_confirmation";
}

export type PayoutAssetOption={assetId:string;blockchain:string;symbol:string;decimals:number;contractAddress?:string};
export type PayoutPreference={chain:string;assetId:string;assetSymbol:string;assetDecimals:number;address:string;verification:"pact_account"|"wallet_signature"|"payee_confirmation"};

export type MeraAccountBalance={address:`0x${string}`;assetSymbol:string;assetDecimals:number;balanceAtomic:string;nativeBalanceAtomic:string;chainId:number};
export type MeraWithdrawalTransaction={chainId:number;nonce:number;to:`0x${string}`;data:`0x${string}`;value:string;gas:string;maxFeePerGas:string;maxPriorityFeePerGas:string};

export interface ExpensePayment {
  /** A scheduled obligation. Actual vendor transfers will use a separate execution record in a later phase. */
  id: string;
  expenseId: string;
  label: string;
  amount: number;
  dueDate?: string;
  fundedAmount: number;
  paidAmount: number;
  processingStartedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayeePayment {
  id: string;
  agreementId: string;
  eventId: string;
  eventName: string;
  agreementTitle: string;
  label: string;
  currency: DisplayCurrency;
  amountMinor: number;
  fundedAmountMinor: number;
  paidAmountMinor: number;
  dueDate?: string;
  processingStartedAt?: string;
  cancelledAt?: string;
}

export interface PayeeWorkspace {
  agreements: PaymentAgreement[];
  invoices: Invoice[];
  payments: PayeePayment[];
  payout: PayoutProfile | null;
}

export interface Allocation {
  id: string;
  eventId: string;
  fundingSourceId: string;
  paymentId: string;
  amount: number;
  executionStatus?: "legacy_unconfirmed" | "authorization_signed" | "submitted" | "confirmed" | "failed" | "reversed";
  transactionHash?: string;
  executionError?: string;
  createdAt: string;
}

export type ExpensePaymentInput = Pick<ExpensePayment, "label" | "amount" | "dueDate" | "fundedAmount" | "paidAmount"> & { id?: string };
export type ExpenseInput = Pick<Expense, "title" | "category" | "totalAmount"> & { payeeName: string; payeeEmail: string; payments: ExpensePaymentInput[] };
export type ExpenseRecord = { expense: Expense; payments: ExpensePayment[] };
