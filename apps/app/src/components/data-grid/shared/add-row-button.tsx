import { Button } from "src/components/elements";
import { AddIcon } from "src/icons";
import { DataGridVariant } from "../types";

type AddRowButtonProps = {
  label?: string;
  onClick: () => void;
  variant: DataGridVariant;
};

export function AddRowButton({ label, onClick, variant }: AddRowButtonProps) {
  if (!label) return null;

  return (
    <Button
      variant={variant === "spreadsheet" ? "default" : "ultra-quiet"}
      size="sm"
      onClick={onClick}
      className={
        variant === "spreadsheet"
          ? "w-full justify-center mt-2"
          : "mx-auto mt-2"
      }
    >
      <AddIcon size="sm" />
      {label}
    </Button>
  );
}
