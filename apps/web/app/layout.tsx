import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./story.css";
import "./onboarding.css";
import PactAuthProvider from "./components/PactAuthProvider";

const siteDescription =
  "Plan event funding, track sponsor contributions, allocate received funds, and release vendor payments from one clear financial operating system.";

function getMetadataBase() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (!configuredUrl) return new URL("http://localhost:3000");

  return new URL(
    configuredUrl.startsWith("http")
      ? configuredUrl
      : `https://${configuredUrl}`,
  );
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: "Pact",
  title: {
    default: "Pact — Built for the people who make events work",
    template: "%s | Pact",
  },
  description: siteDescription,
  keywords: [
    "event finance",
    "event funding",
    "sponsor contributions",
    "vendor payments",
    "event budgets",
    "milestone payments",
  ],
  creator: "Pact",
  publisher: "Pact",
  icons: {
    icon: [{ url: "/pact-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/pact-icon.svg"],
  },
  openGraph: {
    type: "website",
    siteName: "Pact",
    title: "Built for the people who make events work",
    description: siteDescription,
    images: [
      {
        url: "/pact-event-team.png",
        width: 1672,
        height: 941,
        alt: "An event team planning together around a table",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pact — Built for the people who make events work",
    description: siteDescription,
    images: ["/pact-event-team.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><PactAuthProvider>{children}</PactAuthProvider></body>
    </html>
  );
}
