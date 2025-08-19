import type { Metadata } from "next";
import UpgradePage from "./upgrade-page";

export const metadata: Metadata = {
  title: "Upgrade Your Account - epanet-js",
  description:
    "Upgrade to Pro or Personal plan to unlock advanced features for water network modeling with EPANET-JS. Professional support, custom map layers, and more.",
  openGraph: {
    title: "Upgrade Your Account - epanet-js",
    description:
      "Upgrade to Pro or Personal plan to unlock advanced features for water network modeling with EPANET-JS.",
    url: "https://app.epanetjs.com/upgrade",
    siteName: "epanet-js",
    images: {
      url: "https://app.epanetjs.com/banner.png",
      width: 1200,
      height: 630,
    },
  },
};

export default function Page() {
  return <UpgradePage />;
}
