import { checksum } from "src/infra/checksum";

export const DRUMCHAPEL = {
  name: "Drumchapel",
  path: "public/example-models/01-uk-style.inp",
  url: "/example-models/01-uk-style.inp",
  thumbnailUrl: "/example-models/01-uk-style.png",
  hash: "286ab343",
};

export const WATERDOWN = {
  name: "Waterdown",
  path: "public/example-models/02-us-style.inp",
  url: "/example-models/02-us-style.inp",
  thumbnailUrl: "/example-models/02-us-style.png",
  hash: "cec41dab",
};

export const DEMO_NETWORKS = [DRUMCHAPEL, WATERDOWN];

export const DEMO_NETWORK_HASHES = new Set(DEMO_NETWORKS.map((d) => d.hash));

export const isDemoNetwork = (content: string): boolean => {
  return DEMO_NETWORK_HASHES.has(checksum(content));
};
