import { useSideTowardMap } from "src/panels/panel-dock-context";

const offsetToLeaveThePanel = { left: 94, right: 2 } as const;

export const useOutsidePanelPlacement = () => {
  const side = useSideTowardMap();
  return { side, sideOffset: offsetToLeaveThePanel[side] };
};
