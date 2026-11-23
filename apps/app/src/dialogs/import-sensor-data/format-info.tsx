import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useSelectorPortalContainer } from "@epanet-js/ui-kit";
import * as E from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { InfoIcon } from "src/icons";
import type { SensorVocabulary } from "src/lib/sensor-data/parameters";
import { serializeToCsv } from "src/lib/operational-data-io/table-file";
import { FileSystemHelpers } from "src/infra/storage/file-system-helpers";
import { useSensorVocabulary } from "./sensor-vocabulary";

const templateRows = ({
  headers,
  assetTypes,
  parameters,
}: SensorVocabulary) => {
  const word = (words: readonly string[] | undefined, fallback: string) =>
    words?.[0] ?? fallback;
  return [
    [word(headers.sensor, "sensor"), "PT-1", "LT-1"],
    [
      word(headers.type, "type"),
      word(assetTypes.junction, "junction"),
      word(assetTypes.tank, "tank"),
    ],
    [
      word(headers.parameter, "parameter"),
      word(parameters.junction?.pressure, "pressure"),
      word(parameters.tank?.level, "level"),
    ],
    [word(headers.asset, "asset"), "J-1", "T-1"],
    ["00:00", "52.1", "3.4"],
    ["00:15", "51.8", "3.5"],
  ];
};

const exampleRows = (vocabulary: SensorVocabulary) => [
  ...templateRows(vocabulary),
  ["…", "…", "…"],
];

const TEMPLATE_FILE_NAME = "sensor-data-template.csv";

const HEADER_ROWS = 4;

export const FormatInfo = ({
  variant = "icon",
}: {
  variant?: "icon" | "link";
}) => {
  const translate = useTranslate();
  const portalContainer = useSelectorPortalContainer();
  const vocabulary = useSensorVocabulary();
  const label = translate("sensorData.import.format.title");

  const downloadTemplate = () => {
    void FileSystemHelpers.downloadFile(
      TEMPLATE_FILE_NAME,
      serializeToCsv(templateRows(vocabulary)),
    );
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {variant === "link" ? (
          <button
            type="button"
            className="self-start cursor-pointer font-semibold underline hover:text-default"
          >
            {translate("sensorData.import.format.show")}
          </button>
        ) : (
          <E.Button
            type="button"
            variant="quiet"
            className="h-8"
            aria-label={label}
          >
            <InfoIcon />
          </E.Button>
        )}
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <E.StyledPopoverContent
          size="md"
          side="bottom"
          align="start"
          sideOffset={4}
          aria-label={label}
        >
          <E.StyledPopoverArrow />
          <div className="flex flex-col gap-2 text-size-base text-default">
            <h3 className="font-semibold">{label}</h3>
            <table className="w-full border text-size-small tabular-nums">
              <tbody>
                {exampleRows(vocabulary).map((cells, rowIndex) => (
                  <tr key={rowIndex} className="border-t first:border-t-0">
                    {cells.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={clsx(
                          "px-2 py-1 border-l first:border-l-0",
                          cellIndex === 0 && rowIndex < HEADER_ROWS
                            ? "font-semibold"
                            : cellIndex === 0
                              ? "text-subtle italic"
                              : "text-subtle",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-size-small text-subtle">
              {translate("sensorData.import.format.optional")}
            </p>
            <p className="text-size-small text-subtle">
              {translate("sensorData.import.format.readings")}
            </p>
            <E.Button
              type="button"
              className="self-start"
              onClick={downloadTemplate}
            >
              {translate("sensorData.import.format.downloadTemplate")}
            </E.Button>
          </div>
        </E.StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
