import type { NewPactEvent, PactEvent, PactUser } from "./pact-types";

const SESSION_KEY = "pact.preview.session.v1";
const EVENTS_KEY = "pact.preview.events.v1";

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

export const isAuthPreviewEnabled =
  process.env.NEXT_PUBLIC_ENABLE_AUTH_PREVIEW === "true";

export const isDynamicAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
);

export const authClient: AuthClient = new PreviewAuthClient();
export const eventRepository: EventRepository = new BrowserEventRepository();
