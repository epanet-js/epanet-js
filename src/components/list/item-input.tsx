import { useState } from "react";
import { EditableTextFieldWithConfirmation } from "../form/editable-text-field-with-confirmation";

type ItemInputProps = {
  label?: string;
  value: string;
  placeholder?: string;
  onCommit: (name: string) => boolean;
  onCancel: () => void;
  forceValidation?: boolean;
};

export const ItemInput = ({
  label,
  value,
  placeholder,
  onCommit,
  onCancel,
  forceValidation,
}: ItemInputProps) => {
  const [hasError, setHasError] = useState(false);

  const handleChangeValue = (newValue: string): boolean => {
    const hasValidationError = onCommit(newValue);
    setHasError(hasValidationError);
    return hasValidationError;
  };

  return (
    <li
      className="flex items-center text-sm bg-white dark:bg-gray-700 px-1 h-8"
      data-capture-escape-key
    >
      <EditableTextFieldWithConfirmation
        label={label || value}
        value={value}
        onChangeValue={handleChangeValue}
        onReset={onCancel}
        hasError={hasError}
        allowedChars={/(?![\s;])[\x00-\xFF]/}
        maxByteLength={31}
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
