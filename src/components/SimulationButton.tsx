import { LightningBoltIcon } from "@radix-ui/react-icons";
import MenuAction from "./menu_action";
import { translate } from "src/infra/i18n";

export const SimulationButton = () => {
  const handleClick = () => {};

  return (
    <MenuAction
      label={translate("simulate")}
      role="button"
      onClick={handleClick}
      hotkey={"shift+enter"}
    >
      <LightningBoltIcon />
    </MenuAction>
  );
};
