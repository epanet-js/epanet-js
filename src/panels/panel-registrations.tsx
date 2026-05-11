import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useRegisterPanel } from "src/state/panel-layout";
import { hasProfileViewAtom } from "src/state/profile-view";
import { AssetDataTable } from "./data-tables/asset-data-table";
import { ProfileViewPanel } from "./profile-view";

const BOTTOM = { horizontal: "bottom", vertical: "bottom" } as const;

export const PanelRegistrations = () => {
  const dataTablesOn = useFeatureFlag("FLAG_DATA_TABLES");
  const profileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");
  const hasProfileView = useAtomValue(hasProfileViewAtom);

  useRegisterPanel(
    {
      id: "junction",
      labelKey: "junctions",
      component: () => <AssetDataTable assetType="junction" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "pipe",
      labelKey: "pipes",
      component: () => <AssetDataTable assetType="pipe" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "pump",
      labelKey: "pumps",
      component: () => <AssetDataTable assetType="pump" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "valve",
      labelKey: "valves",
      component: () => <AssetDataTable assetType="valve" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "reservoir",
      labelKey: "reservoirs",
      component: () => <AssetDataTable assetType="reservoir" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "tank",
      labelKey: "tanks",
      component: () => <AssetDataTable assetType="tank" />,
      defaultZone: BOTTOM,
    },
    dataTablesOn,
  );
  useRegisterPanel(
    {
      id: "profile-view",
      labelKey: "profileView.title",
      component: ProfileViewPanel,
      defaultZone: BOTTOM,
    },
    profileViewOn && hasProfileView,
  );

  return null;
};
