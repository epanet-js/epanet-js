import { useState } from "react";
import { EditableTextFieldWithConfirmation } from "../form/editable-text-field-with-confirmation";
import { type IndentGuide, IndentGuides } from "./indent-guides";

type ItemInputProps = {
  label?: string;
  value: string;
  placeholder?: string;
  sanitize?: (raw: string) => string;
  onCommit: (name: string) => boolean;
  onCancel: () => void;
  forceValidation?: boolean;
  depth?: number;
  indentGuides?: readonly IndentGuide[];
};

export const ItemInput = ({
  label,
  value,
  placeholder,
  sanitize,
  onCommit,
  onCancel,
  forceValidation,
  depth = 0,
  indentGuides = [],
}: ItemInputProps) => {
  const [hasError, setHasError] = useState(false);

  const handleChangeValue = (newValue: string): boolean => {
    const hasValidationError = onCommit(newValue);
    setHasError(hasValidationError);
    return hasValidationError;
  };

  return (
    <li
      style={{ paddingLeft: `calc(${depth}rem + 3px)` }}
      className="relative flex items-center text-sm bg-white dark:bg-gray-700 pr-1 h-8"
      data-capture-escape-key
    >
      <IndentGuides guides={indentGuides} />
      <EditableTextFieldWithConfirmation
        label={label || value}
        value={value}
        onChangeValue={handleChangeValue}
        onReset={onCancel}
        hasError={hasError}
        sanitize={sanitize}
        styleOptions={{
          padding: "sm",
          textSize: "sm",
        }}
        placeholder={placeholder}
        autoFocus
        forceValidation={forceValidation}
      />
    </li>
  );
};
