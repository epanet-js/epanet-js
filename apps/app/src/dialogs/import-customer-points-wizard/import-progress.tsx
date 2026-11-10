import React from "react";
import { useTranslate } from "src/hooks/use-translate";

const BUILDING_SHARE = 80;

export type ImportProgress =
  | { phase: "building"; fraction: number }
  | { phase: "applying" };

export const ImportProgressPanel: React.FC<{ progress: ImportProgress }> = ({
  progress,
}) => {
  const translate = useTranslate();
  const percent =
    progress.phase === "building"
      ? Math.round(progress.fraction * BUILDING_SHARE)
      : BUILDING_SHARE;
  const message =
    progress.phase === "building"
      ? translate("importCustomerPoints.wizard.importProgress.building")
      : translate("importCustomerPoints.wizard.importProgress.applying");

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-default" role="status">
        {message}
      </p>
      <div
        className="w-full max-w-md bg-track rounded-full h-2"
        role="progressbar"
        aria-label={message}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="bg-accent h-2 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
