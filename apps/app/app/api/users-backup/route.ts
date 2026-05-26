import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { logger } from "src/infra/server-logger";
import { clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const bucketName = "epanet-js-users-backups";

export async function GET(request: NextRequest) {
  if (
    process.env.CRON_SECRET &&
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  logger.info("Generating backup with all users");
  const data = await generateAllUsersJSON();

  const destination = `${Date.now()}.json`;

  const path = await store(bucketName, destination, data);

  return NextResponse.json({ status: "success", path });
}

const store = async (
  bucketName: string,
  destination: string,
  data: string,
): Promise<string> => {
  const path = `${bucketName}:${destination}`;
  const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY,
    },
  });

  logger.info(`Storing item at ${path}`);
  await storage.bucket(bucketName).file(destination).save(data);

  return path;
};

const generateAllUsersJSON = async (): Promise<string> => {
  let offset = 0;
  const limit = 100;
  const result = [];
  const client = await clerkClient();
  while (true) {
    const { data } = await client.users.getUserList({
      orderBy: "+created_at",
      limit,
      offset,
    });

    result.push(...data);
    if (data.length < limit) break;

    offset += limit;
  }

  return JSON.stringify(result);
};
