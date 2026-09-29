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

export interface PactUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PactEvent {
  id: string;
  ownerId: string;
  name: string;
  date: string;
  estimatedBudget: number;
  displayCurrency: DisplayCurrency;
  eventType?: EventType;
  status: "active";
  createdAt: string;
}

export type NewPactEvent = Pick<
  PactEvent,
  "name" | "date" | "estimatedBudget" | "displayCurrency" | "eventType"
>;
