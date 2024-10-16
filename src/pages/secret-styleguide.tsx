import Head from "next/head";
import { StyleGuide } from "src/components/style_guide";

const SecretStyleGuide = () => {
  return (
    <>
      <Head>
        <title>Secret styleguide</title>
      </Head>
      <StyleGuide />
    </>
  );
};

export default SecretStyleGuide;
