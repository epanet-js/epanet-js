import { LogoIcon, LogoWordmarkIcon } from "./elements";

type AppLoaderProps = {
  progress: number;
};

export const AppLoader = ({ progress }: AppLoaderProps) => {
  return (
    <div className="h-dvh flex items-center justify-center bg-white dark:bg-gray-800">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="grid gap-2 justify-center justify-items-center">
          <LogoIcon size={40} />
          <LogoWordmarkIcon size={88} />
        </div>
        <div className="w-full mt-6">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-400 h-2 rounded-full transition-all duration-200 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
