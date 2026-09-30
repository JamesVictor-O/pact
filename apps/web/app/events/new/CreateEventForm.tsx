"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppTopbar from "../../components/AppTopbar";
import { eventRepository } from "../../../lib/pact-storage";
import { DISPLAY_CURRENCIES, EVENT_TYPES, type DisplayCurrency, type EventType, type PactUser } from "../../../lib/pact-types";
import { usePactAuth } from "../../components/PactAuthProvider";

type FormValues = {
  name: string;
  date: string;
  estimatedBudget: string;
  displayCurrency: DisplayCurrency;
  eventType: EventType | "";
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = { name: "", date: "", estimatedBudget: "", displayCurrency: "USD", eventType: "" };

function parseBudget(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Enter an event name.";
  if (!values.date) errors.date = "Choose the event date.";
  const budget = parseBudget(values.estimatedBudget);
  if (!values.estimatedBudget.trim() || !Number.isFinite(budget) || budget <= 0) errors.estimatedBudget = "Enter an estimated budget greater than zero.";
  if (!DISPLAY_CURRENCIES.includes(values.displayCurrency)) errors.displayCurrency = "Choose a display currency.";
  return errors;
}

export default function CreateEventForm() {
  const router = useRouter();
  const { ready: authReady, user: authenticatedUser } = usePactAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [user, setUser] = useState<PactUser | null>(null);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "submitting" | "success">("loading");
  const [createdName, setCreatedName] = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (!authenticatedUser) {
      router.replace("/auth");
      return;
    }
    setUser(authenticatedUser);
    setStatus("idle");
  }, [authReady, authenticatedUser, router]);

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateField(field: keyof FormValues) {
    const fieldError = validate(values)[field];
    setErrors((current) => ({ ...current, [field]: fieldError }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle" || !user) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    const firstInvalidField = (Object.keys(nextErrors) as (keyof FormValues)[])[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#${firstInvalidField}`)?.focus());
      return;
    }

    setStatus("submitting");
    setSubmitError("");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const created = eventRepository.create(user.id, {
        name: values.name.trim(),
        date: values.date,
        estimatedBudget: parseBudget(values.estimatedBudget),
        displayCurrency: values.displayCurrency,
        eventType: values.eventType || undefined,
      });
      setCreatedName(created.name);
      setStatus("success");
      window.setTimeout(() => router.replace(`/events/${created.id}?created=1`), 650);
    } catch {
      setStatus("idle");
      setSubmitError("We couldn’t create this Pact. Your details are still here—please try again.");
    }
  }

  if (status === "loading") return <main className="app-standalone"><AppTopbar compact /><div className="form-page-shell"><div className="form-skeleton" aria-label="Loading event form" /></div></main>;

  if (status === "success") return <main className="app-standalone"><AppTopbar userName={user?.name} compact /><section className="creation-success" aria-live="polite"><span><Check aria-hidden="true" /></span><p className="app-eyebrow">Pact created</p><h1>{createdName}</h1><p>Your financial workspace is ready. Taking you to the overview…</p></section></main>;

  return <main className="app-standalone">
    <AppTopbar userName={user?.name} compact />
    <div className="form-page-shell">
      <div className="form-page-intro"><p className="app-eyebrow">New event workspace</p><h1>Create your Pact</h1><p>Start with the basics. You can add funding, payees, and payment schedules next.</p></div>
      <form ref={formRef} className="create-event-form" onSubmit={submit} noValidate aria-busy={status === "submitting"}>
        <div className="form-field">
          <label htmlFor="name">Event name <span>Required</span></label>
          <input id="name" name="name" type="text" autoComplete="off" placeholder="Build Forward Conference" value={values.name} onChange={(event) => setField("name", event.target.value)} onBlur={() => validateField("name")} aria-invalid={errors.name ? "true" : undefined} aria-describedby={errors.name ? "name-error" : "name-hint"} />
          {errors.name ? <p className="field-error" id="name-error">{errors.name}</p> : <p className="field-hint" id="name-hint">Use the name your team already knows.</p>}
        </div>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="date">Event date <span>Required</span></label>
            <input id="date" name="date" type="date" value={values.date} onChange={(event) => setField("date", event.target.value)} onBlur={() => validateField("date")} aria-invalid={errors.date ? "true" : undefined} aria-describedby={errors.date ? "date-error" : undefined} />
            {errors.date && <p className="field-error" id="date-error">{errors.date}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="eventType">Event type <span>Optional</span></label>
            <select id="eventType" name="eventType" value={values.eventType} onChange={(event) => setField("eventType", event.target.value as EventType | "")}><option value="">Select a type</option>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
          </div>
        </div>
        <fieldset className="budget-fieldset"><legend>Working budget</legend><div className="form-row budget-row">
          <div className="form-field budget-input-field">
            <label htmlFor="estimatedBudget">Estimated budget <span>Required</span></label>
            <div className="currency-input"><span>{values.displayCurrency}</span><input id="estimatedBudget" name="estimatedBudget" type="text" inputMode="decimal" autoComplete="off" placeholder="30,000" value={values.estimatedBudget} onChange={(event) => setField("estimatedBudget", event.target.value)} onBlur={() => validateField("estimatedBudget")} aria-invalid={errors.estimatedBudget ? "true" : undefined} aria-describedby={errors.estimatedBudget ? "estimatedBudget-error" : "budget-hint"} /></div>
            {errors.estimatedBudget ? <p className="field-error" id="estimatedBudget-error">{errors.estimatedBudget}</p> : <p className="field-hint" id="budget-hint">A planning estimate—you can refine it later.</p>}
          </div>
          <div className="form-field currency-select-field">
            <label htmlFor="displayCurrency">Display currency <span>Required</span></label>
            <select id="displayCurrency" name="displayCurrency" value={values.displayCurrency} onChange={(event) => setField("displayCurrency", event.target.value as DisplayCurrency)}>{DISPLAY_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select>
          </div>
        </div></fieldset>
        {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
        <div className="form-submit-row"><p>You’ll add funding and expenses after this step.</p><button className="app-primary-button" type="submit" disabled={status === "submitting"}>{status === "submitting" ? <><LoaderCircle className="button-spinner" aria-hidden="true" /> Creating your Pact…</> : <>Create Pact <ArrowRight aria-hidden="true" /></>}</button></div>
      </form>
    </div>
  </main>;
}
