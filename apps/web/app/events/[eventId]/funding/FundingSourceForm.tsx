"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FUNDING_TYPE_LABELS } from "../../../../lib/funding";
import { fundingRepository } from "../../../../lib/pact-storage";
import { FUNDING_SOURCE_TYPES, type FundingSource, type FundingSourceType } from "../../../../lib/pact-types";
import { useCurrentEvent } from "../EventShell";

type FormValues = {
  type: FundingSourceType | "";
  name: string;
  committedAmount: string;
  receivedAmount: string;
  expectedDate: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const emptyValues: FormValues = { type: "", name: "", committedAmount: "", receivedAmount: "0", expectedDate: "", notes: "" };

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const committed = parseAmount(values.committedAmount);
  const received = parseAmount(values.receivedAmount || "0");
  if (!values.type) errors.type = "Choose where this money is coming from.";
  if (!values.name.trim()) errors.name = "Enter a name for this funding source.";
  if (!values.committedAmount.trim() || !Number.isFinite(committed) || committed <= 0) errors.committedAmount = "Enter a committed amount greater than zero.";
  if (!Number.isFinite(received) || received < 0) errors.receivedAmount = "Enter zero or a positive received amount.";
  else if (Number.isFinite(committed) && received > committed) errors.receivedAmount = "Received funding cannot exceed the committed amount without confirmation. Adjust one of the amounts.";
  return errors;
}

function valuesFromSource(source: FundingSource): FormValues {
  return {
    type: source.type,
    name: source.name,
    committedAmount: String(source.committedAmount),
    receivedAmount: String(source.receivedAmount),
    expectedDate: source.expectedDate ?? "",
    notes: source.notes ?? "",
  };
}

export default function FundingSourceForm({ sourceId }: { sourceId?: string }) {
  const event = useCurrentEvent();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"loading" | "idle" | "submitting" | "missing">(sourceId ? "loading" : "idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!sourceId) return;
    const source = fundingRepository.findById(sourceId);
    if (!source || source.eventId !== event.id) {
      setStatus("missing");
      return;
    }
    setValues(valuesFromSource(source));
    setStatus("idle");
  }, [event.id, sourceId]);

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function changeType(type: FundingSourceType) {
    const previousDefault = values.type === "organizer" ? "Organizer funds" : values.type === "ticket_revenue" ? "Ticket revenue" : "";
    const nextDefault = type === "organizer" ? "Organizer funds" : type === "ticket_revenue" ? "Ticket revenue" : "";
    setValues((current) => ({ ...current, type, name: !current.name || current.name === previousDefault ? nextDefault : current.name }));
    setErrors((current) => ({ ...current, type: undefined }));
  }

  function validateField(field: keyof FormValues) {
    setErrors((current) => ({ ...current, [field]: validate(values)[field] }));
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (status !== "idle") return;
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
      const input = {
        type: values.type as FundingSourceType,
        name: values.name.trim(),
        committedAmount: parseAmount(values.committedAmount),
        receivedAmount: parseAmount(values.receivedAmount || "0"),
        expectedDate: values.expectedDate || undefined,
        notes: values.notes.trim() || undefined,
      };
      const saved = sourceId ? fundingRepository.update(sourceId, input) : fundingRepository.create(event.id, input);
      if (!saved) throw new Error("Funding source not found");
      router.replace(`/events/${event.id}/funding?${sourceId ? "updated" : "added"}=1`);
    } catch {
      setStatus("idle");
      setSubmitError("We couldn’t save this funding source. Your details are still here—please try again.");
    }
  }

  if (status === "loading") return <div className="funding-form-skeleton" aria-label="Loading funding source" />;
  if (status === "missing") return <section className="funding-error"><h1>Funding source not found</h1><p>It may have been removed or belong to another event.</p><Link className="app-secondary-button" href={`/events/${event.id}/funding`}>Back to funding</Link></section>;

  const type = values.type;
  const nameLabel = type === "sponsor" ? "Sponsor name" : type === "grant" ? "Grant or funder name" : "Source name";
  const submitLabel = sourceId ? "Save changes" : type === "sponsor" ? "Add sponsor" : type === "organizer" ? "Add organizer funds" : "Add funding source";

  return <div className="funding-form-page">
    <Link className="app-back-link" href={sourceId ? `/events/${event.id}/funding/${sourceId}` : `/events/${event.id}/funding`}><ArrowLeft aria-hidden="true" /> Back to funding</Link>
    <header><p className="app-eyebrow">{sourceId ? "Edit funding source" : "New funding source"}</p><h1>{sourceId ? "Update the funding plan" : "Where is this money coming from?"}</h1><p>Record the commitment and only count money that has actually arrived as received.</p></header>
    <form ref={formRef} className="funding-source-form" onSubmit={submit} noValidate aria-busy={status === "submitting"}>
      <fieldset className="funding-type-fieldset" aria-describedby={errors.type ? "type-error" : undefined}><legend>Funding source type <span>Required</span></legend><div className="funding-type-grid">{FUNDING_SOURCE_TYPES.map((option) => <label key={option} className={values.type === option ? "selected" : ""}><input id={option === FUNDING_SOURCE_TYPES[0] ? "type" : undefined} type="radio" name="type" value={option} checked={values.type === option} onChange={() => changeType(option)} /><span>{FUNDING_TYPE_LABELS[option]}</span></label>)}</div>{errors.type && <p className="field-error" id="type-error">{errors.type}</p>}</fieldset>

      <div className="form-field"><label htmlFor="name">{nameLabel} <span>Required</span></label><input id="name" name="name" type="text" autoComplete="organization" spellCheck={false} placeholder={type === "sponsor" ? "Northstar Studios" : type === "partner" ? "Event partner" : "Funding source"} value={values.name} onChange={(e) => setField("name", e.target.value)} onBlur={() => validateField("name")} aria-invalid={errors.name ? "true" : undefined} aria-describedby={errors.name ? "name-error" : undefined} />{errors.name && <p className="field-error" id="name-error">{errors.name}</p>}</div>

      <div className="form-row">
        <div className="form-field"><label htmlFor="committedAmount">Committed amount <span>Required</span></label><div className="currency-input"><span>{event.displayCurrency}</span><input id="committedAmount" name="committedAmount" type="text" inputMode="decimal" autoComplete="off" placeholder="10,000" value={values.committedAmount} onChange={(e) => setField("committedAmount", e.target.value)} onBlur={() => validateField("committedAmount")} aria-invalid={errors.committedAmount ? "true" : undefined} aria-describedby={errors.committedAmount ? "committedAmount-error" : "committedAmount-hint"} /></div>{errors.committedAmount ? <p className="field-error" id="committedAmount-error">{errors.committedAmount}</p> : <p className="field-hint" id="committedAmount-hint">The total amount promised or forecast.</p>}</div>
        <div className="form-field"><label htmlFor="receivedAmount">Amount already received</label><div className="currency-input"><span>{event.displayCurrency}</span><input id="receivedAmount" name="receivedAmount" type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={values.receivedAmount} onChange={(e) => setField("receivedAmount", e.target.value)} onBlur={() => validateField("receivedAmount")} aria-invalid={errors.receivedAmount ? "true" : undefined} aria-describedby={errors.receivedAmount ? "receivedAmount-error" : "receivedAmount-hint"} /></div>{errors.receivedAmount ? <p className="field-error" id="receivedAmount-error">{errors.receivedAmount}</p> : <p className="field-hint" id="receivedAmount-hint">Only include money that has actually arrived.</p>}</div>
      </div>

      <div className="form-field"><label htmlFor="expectedDate">Expected by <span>Optional</span></label><input id="expectedDate" name="expectedDate" type="date" value={values.expectedDate} onChange={(e) => setField("expectedDate", e.target.value)} /><p className="field-hint">Leave blank if this source has no expected date.</p></div>
      <div className="form-field"><label htmlFor="notes">Notes <span>Optional</span></label><textarea id="notes" name="notes" rows={4} placeholder="Terms, context, or internal notes" value={values.notes} onChange={(e) => setField("notes", e.target.value)} /></div>

      {submitError && <p className="form-submit-error" role="alert">{submitError}</p>}
      <div className="funding-form-actions"><Link className="app-secondary-button" href={sourceId ? `/events/${event.id}/funding/${sourceId}` : `/events/${event.id}/funding`}>Cancel</Link><button className="app-primary-button" type="submit" disabled={status === "submitting"}>{status === "submitting" ? <><LoaderCircle className="button-spinner" aria-hidden="true" /> Saving…</> : <>{submitLabel}<ArrowRight aria-hidden="true" /></>}</button></div>
    </form>
  </div>;
}
