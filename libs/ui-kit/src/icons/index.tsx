import type { ComponentProps } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

type IconProps = Omit<ComponentProps<LucideIcon>, "ref">;

const icon = (Icon: LucideIcon) => {
  return ({ size = 16, ...props }: IconProps) => (
    <Icon size={size} {...props} />
  );
};

export const ChevronDownIcon = icon(ChevronDown);
export const CheckIcon = icon(Check);
