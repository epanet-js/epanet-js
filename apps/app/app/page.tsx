import type { Metadata } from "next";
import HomePage from "./home-page";

export const metadata: Metadata = {
  title: "epanet-js",
};

export default function Page() {
  return <HomePage />;
}
