import { checksum } from "src/infra/checksum";

export const DEMO_NETWORKS = [
  { path: "public/example-models/01-uk-style.inp", hash: "286ab343" },
  { path: "public/example-models/02-us-style.inp", hash: "cec41dab" },
];

export const DEMO_NETWORK_HASHES = new Set(DEMO_NETWORKS.map((d) => d.hash));

export const isDemoNetwork = (content: string): boolean => {
  return DEMO_NETWORK_HASHES.has(checksum(content));
};
