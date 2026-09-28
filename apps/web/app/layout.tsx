import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./story.css";

export const metadata: Metadata = {
  title: "Pact — Financial infrastructure for events",
  description:
    "Manage event funding, vendor commitments, payment schedules, and payouts from one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
