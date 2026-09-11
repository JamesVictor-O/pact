import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import "./landing.css";
import "./payment-visuals.css";

export const metadata: Metadata = {
  title: "Morva — A payment link. More ways to pay.",
  description:
    "Share a payment link. Let buyers pay with supported crypto assets and receive your chosen stablecoin on Monad. Explore the Morva product preview.",
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
