import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useRegisterPanel } from "src/state/panel-layout";
import { hasHglProfileAtom } from "src/state/hgl-profile";
import { AssetDataTable } from "./data-tables/asset-data-table";
import { CustomerPointDataTable } from "./data-tables/customer-point-data-table";
import { HglProfilePanel } from "./hgl-profile";

const BOTTOM = { horizontal: "bottom", vertical: "bottom" } as const;

export const PanelRegistrations = () => {
  const hasHglProfile = useAtomValue(hasHglProfileAtom);
  const cpDataTableOn = useFeatureFlag("FLAG_CP_DATA_TABLE");

  const AssetDataTableComponent = AssetDataTable;

  useRegisterPanel({
    id: "junction",
    labelKey: "junctions",
    component: () => <AssetDataTableComponent assetType="junction" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel({
    id: "pipe",
    labelKey: "pipes",
    component: () => <AssetDataTableComponent assetType="pipe" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel({
    id: "pump",
    labelKey: "pumps",
    component: () => <AssetDataTableComponent assetType="pump" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel({
    id: "valve",
    labelKey: "valves",
    component: () => <AssetDataTableComponent assetType="valve" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel({
    id: "reservoir",
    labelKey: "reservoirs",
    component: () => <AssetDataTableComponent assetType="reservoir" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel({
    id: "tank",
    labelKey: "tanks",
    component: () => <AssetDataTableComponent assetType="tank" />,
    defaultZone: BOTTOM,
  });
  useRegisterPanel(
    {
      id: "customer-point",
      labelKey: "customerPoints",
      component: CustomerPointDataTable,
      defaultZone: BOTTOM,
    },
    cpDataTableOn,
  );
  useRegisterPanel(
    {
      id: "hgl-profile",
      labelKey: "hglProfile.title",
      component: HglProfilePanel,
      defaultZone: BOTTOM,
    },
    hasHglProfile,
  );

  return null;
};
