import { Link2Off, LucideIcon, LucideProps } from "lucide-react";
import { Link2 } from "lucide-react";

type IconProps = LucideProps;

const icon = (Icon: LucideIcon): React.FC<IconProps> => {
  return (props) => <Icon size={16} {...props} />;
};

export const ConnectIcon = icon(Link2);
export const DisconnectIcon = icon(Link2Off);
