import { logger } from "./server-logger";

const kitApiKey = process.env.KIT_API_KEY as string;
const kitApiSecret = process.env.KIT_API_SECRET as string;
const signUpFormId = process.env.KIT_SIGN_UP_FORM as string;

const baseUrl = "https://api.convertkit.com";

export type UpdateResult = {
  status: "success" | "failure";
};

export type Subscriber = {
  id: string;
  first_name: string;
  email_address: string;
  state: "active";
  created_at: string;
  fields: { [key: string]: string };
};

export const fetchAllSubscribers = async (): Promise<Subscriber[]> => {
  let page = 1;
  let totalPages = 1;
  const allSubscribers: Subscriber[] = [];

  while (page <= totalPages) {
    const response = await requestKit(`/v3/subscribers?page=${page}`);
    const data = await response.json();
    const { subscribers, total_pages: newTotalPages } = data;
    allSubscribers.push(...subscribers);
    totalPages = newTotalPages;
    page++;
  }
  return allSubscribers;
};

export const addToSubscribers = async (
  email: string,
  firstName: string | null,
  lastName: string | null,
): Promise<UpdateResult> => {
  if (!kitApiKey || !kitApiSecret) {
    logger.info(`Missing kit configuration, skipping...`);
    return { status: "success" };
  }

  logger.info(`Adding ${email} to subscribers`);

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: kitApiKey,
      email: email,
      first_name: firstName,
      fields: { last_name: lastName },
    }),
  };

  const response = await requestKit(
    `/v3/forms/${signUpFormId}/subscribe`,
    options,
  );

  return buildUpdateResult(response);
};

export const checkHealth = async () => {
  logger.info("Checking KIT health");
  const response = await requestKit("/v3/account");
  if (!response.ok)
    throw new Error(`Error checking KIT health (status: ${response.status})`);

  logger.info("KIT is OK");
};

const requestKit = async (
  endpoint: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = new URL(endpoint, baseUrl);
  url.searchParams.append("api_secret", kitApiSecret);

  const response = await fetch(url, options);

  if (process.env.DEBUG_KIT_REQUESTS === "true") {
    logger.info(`Kit response (${response.status}): ${await response.text()}`);
  } else {
    logger.info(`Kit response (${response.status})`);
  }
  return response;
};

const buildUpdateResult = (response: Response): UpdateResult => ({
  status: response.status === 200 ? "success" : "failure",
});
