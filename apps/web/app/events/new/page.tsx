import type { Metadata } from "next";
import CreateEventForm from "./CreateEventForm";

export const metadata: Metadata = { title: "Set up your event" };

export default function NewEventPage() {
  return <CreateEventForm />;
}
