import type { Metadata } from "next";
import CreateEventForm from "./CreateEventForm";

export const metadata: Metadata = { title: "Create your Pact" };

export default function NewEventPage() {
  return <CreateEventForm />;
}
