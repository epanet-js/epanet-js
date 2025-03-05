import "src/styles/globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "epanet-js",
  description: "Welcome to epanet-js",
  applicationName: "epanet-js",
};
