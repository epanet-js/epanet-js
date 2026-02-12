import { useOpenInpFromUrl } from "src/commands/open-inp-from-url";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { DRUMCHAPEL, WATERDOWN } from "src/demo/demo-networks";
import Image from "next/image";

type DemoModel = {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string;
};

export const DemoNetworksList = () => {
  const translate = useTranslate();
  const demoModels: DemoModel[] = [
    {
      name: DRUMCHAPEL.name,
      description: translate("demoUKStyleDescription"),
      url: DRUMCHAPEL.url,
      thumbnailUrl: DRUMCHAPEL.thumbnailUrl,
    },
    {
      name: WATERDOWN.name,
      description: translate("demoUSStyleDescription"),
      url: WATERDOWN.url,
      thumbnailUrl: WATERDOWN.thumbnailUrl,
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      {demoModels.map((demoModel, i) => (
        <DemoNetworkCard key={i} demoNetwork={demoModel} />
      ))}
    </div>
  );
};

export const DemoNetworkCard = ({
  demoNetwork,
}: {
  demoNetwork: DemoModel;
}) => {
  const userTracking = useUserTracking();
  const { openInpFromUrl } = useOpenInpFromUrl();

  const handleOpenDemoModel = () => {
    userTracking.capture({
      name: "exampleModel.clicked",
      modelName: demoNetwork.name,
    });
    void openInpFromUrl(demoNetwork.url);
  };
  return (
    <div
      className="flex flex-col max-w-[250px] items-center gap-x-2 bg-w smhite shadow-md  rounded-lg border cursor-pointer hover:bg-gray-400 hover:bg-opacity-10"
      onClick={handleOpenDemoModel}
    >
      <div className="flex-shrink-0">
        <Image
          src={demoNetwork.thumbnailUrl}
          alt={demoNetwork.name}
          width={247}
          height={200}
          quality={90}
          className="rounded-md object-cover"
        />
      </div>
      <div className="flex flex-col p-3">
        <span className="text-gray-600 font-bold text-sm">
          {demoNetwork.name}
        </span>
        <span className="text-xs">{demoNetwork.description}</span>
      </div>
    </div>
  );
};
