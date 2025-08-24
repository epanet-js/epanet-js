import "src/styles/globals.css";
import { headers } from "next/headers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const latitude = headersList.get("x-vercel-ip-latitude");
  const longitude = headersList.get("x-vercel-ip-longitude");

  const userLocation =
    latitude && longitude
      ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
      : null;

  return (
    <html lang="en" className="notranslate" translate="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-user-location={JSON.stringify(userLocation)}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "epanet-js",
  description:
    "Run EPANET in your browser with epanet-js — no download needed. Works on Mac, Linux, or Windows. Save files locally. Modern, enhanced, and built on the trusted EPANET engine.",
  openGraph: {
    title:
      "epanet-js: EPANET in your browser — start water modeling now, no download required.",
    description:
      "Run EPANET in your browser with epanet-js — no download needed. Works on Mac, Linux, or Windows. Save files locally. Modern, enhanced, and built on the trusted EPANET engine.",
    url: "https://app.epanetjs.com",
    siteName: "epanet-js",
    images: {
      url: "https://app.epanetjs.com/banner.png",
      width: 1200,
      height: 630,
    },
  },
  applicationName: "epanet-js",
};
