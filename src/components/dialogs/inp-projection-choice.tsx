import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

const NonProjectedIllustration = () => (
  <svg
    viewBox="0 0 200 120"
    className="w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background */}
    <rect width="200" height="120" fill="#f9fafb" rx="4" />

    {/* Grid lines */}
    {[30, 60, 90, 120, 150, 170].map((x) => (
      <line
        key={`v${x}`}
        x1={x}
        y1="10"
        x2={x}
        y2="110"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
    ))}
    {[20, 40, 60, 80, 100].map((y) => (
      <line
        key={`h${y}`}
        x1="20"
        y1={y}
        x2="180"
        y2={y}
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
    ))}

    {/* Axis labels */}
    <text x="185" y="65" fontSize="7" fill="#9ca3af" fontFamily="sans-serif">
      X
    </text>
    <text x="95" y="8" fontSize="7" fill="#9ca3af" fontFamily="sans-serif">
      Y
    </text>

    {/* Network pipes */}
    <polyline
      points="50,85 80,50 130,50"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="80"
      y1="50"
      x2="80"
      y2="30"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="130,50 160,70 160,90"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="130"
      y1="50"
      x2="130"
      y2="80"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Nodes */}
    <circle cx="50" cy="85" r="2.5" fill="#4f46e5" />
    <circle cx="80" cy="50" r="2.5" fill="#4f46e5" />
    <circle cx="80" cy="30" r="2.5" fill="#4f46e5" />
    <circle cx="130" cy="50" r="2.5" fill="#4f46e5" />
    <circle cx="130" cy="80" r="2.5" fill="#4f46e5" />
    <circle cx="160" cy="70" r="2.5" fill="#4f46e5" />
    <circle cx="160" cy="90" r="2.5" fill="#4f46e5" />
  </svg>
);

const ProjectedIllustration = () => (
  <svg
    viewBox="0 0 200 120"
    className="w-full h-full"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Map background */}
    <rect width="200" height="120" fill="#e8f0e4" rx="4" />

    {/* Water body */}
    <path
      d="M0,90 Q30,75 60,85 Q90,95 120,80 Q150,65 180,75 L200,70 L200,120 L0,120 Z"
      fill="#bfdcf5"
      opacity="0.6"
    />

    {/* Building blocks */}
    <rect
      x="95"
      y="20"
      width="12"
      height="10"
      rx="1"
      fill="#d4d8dc"
      opacity="0.5"
    />
    <rect
      x="110"
      y="22"
      width="8"
      height="8"
      rx="1"
      fill="#d4d8dc"
      opacity="0.5"
    />
    <rect
      x="38"
      y="35"
      width="10"
      height="8"
      rx="1"
      fill="#d4d8dc"
      opacity="0.5"
    />
    <rect
      x="165"
      y="35"
      width="10"
      height="12"
      rx="1"
      fill="#d4d8dc"
      opacity="0.5"
    />

    {/* Network pipes */}
    <polyline
      points="50,65 80,40 130,40"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="80"
      y1="40"
      x2="80"
      y2="20"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <polyline
      points="130,40 160,55 160,72"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="130"
      y1="40"
      x2="130"
      y2="65"
      stroke="#4f46e5"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Nodes */}
    <circle cx="50" cy="65" r="2.5" fill="#4f46e5" />
    <circle cx="80" cy="40" r="2.5" fill="#4f46e5" />
    <circle cx="80" cy="20" r="2.5" fill="#4f46e5" />
    <circle cx="130" cy="40" r="2.5" fill="#4f46e5" />
    <circle cx="130" cy="65" r="2.5" fill="#4f46e5" />
    <circle cx="160" cy="55" r="2.5" fill="#4f46e5" />
    <circle cx="160" cy="72" r="2.5" fill="#4f46e5" />
  </svg>
);

export const InpProjectionChoiceDialog = ({
  onImportNonProjected,
}: {
  onImportNonProjected: () => void;
}) => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const handleProjected = () => {
    userTracking.capture({ name: "inpProjectionChoice.projected" });
    setDialogState({
      type: "inpGeocodingNotSupported",
      onImportNonProjected,
    });
  };

  const handleNonProjected = () => {
    userTracking.capture({ name: "inpProjectionChoice.nonProjected" });
    onImportNonProjected();
  };

  return (
    <DialogContainer size="sm">
      <DialogHeader title={translate("inpProjectionChoice.title")} />
      <p className="text-sm text-gray-700 dark:text-gray-300 pb-4">
        {translate("inpProjectionChoice.description")}
      </p>

      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          type="button"
          onClick={handleNonProjected}
          className="text-left cursor-pointer rounded-md p-3 border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors"
        >
          <div className="w-full rounded mb-2 overflow-hidden">
            <NonProjectedIllustration />
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {translate("inpProjectionChoice.nonProjectedTitle")}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {translate("inpProjectionChoice.nonProjectedDescription")}
          </div>
        </button>

        <button
          type="button"
          onClick={handleProjected}
          className="text-left cursor-pointer rounded-md p-3 border-2 border-gray-200 bg-white hover:border-purple-500 hover:bg-purple-50 dark:bg-transparent dark:border-gray-700 dark:hover:border-purple-500 dark:hover:bg-purple-950 transition-colors"
        >
          <div className="w-full rounded mb-2 overflow-hidden">
            <ProjectedIllustration />
          </div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {translate("inpProjectionChoice.projectedTitle")}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {translate("inpProjectionChoice.projectedDescription")}
          </div>
        </button>
      </div>
    </DialogContainer>
  );
};
