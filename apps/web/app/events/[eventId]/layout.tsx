import EventShell from "./EventShell";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventShell eventId={eventId}>{children}</EventShell>;
}
