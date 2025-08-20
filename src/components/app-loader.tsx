import { SiteIcon } from "./elements";

type AppLoaderProps = {
  progress: number;
};

export const AppLoader = ({ progress }: AppLoaderProps) => {
  return (
    <div className="h-dvh flex items-center justify-center bg-white dark:bg-gray-800">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mx-auto rounded-lg flex items-center justify-center mb-6">
          <SiteIcon className="text-center w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl text-gray-500 dark:text-white pb-4">
            epanet-js
          </h1>
        </div>

        <div className="w-full">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-400 h-2 rounded-full transition-all duration-2000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
