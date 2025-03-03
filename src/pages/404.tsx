import Head from "next/head";
import Link from "next/link";
import { HomeIcon } from "@radix-ui/react-icons";
import { formatTitle } from "src/lib/utils";

export default function Page404() {
  return (
    <>
      <Head>
        <title>{formatTitle("404: Page not found")}</title>
      </Head>
      <div className="h-screen flex items-center justify-center">
        <div className="w-64">
          <div className="text-4xl font-bold">epanet-js</div>
          <div className="pt-4 text-lg">Sorry, we couldn’t find that page.</div>
          <div className="pt-4 text-lg">
            <Link
              href="/"
              className="inline-flex items-center gap-x-2 underline"
            >
              <HomeIcon />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
