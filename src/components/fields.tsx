import { Field, ErrorMessage } from "formik";
import { InlineError } from "./inline-error";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { styledSelect } from "./elements";

// Only INP format is supported for EPANET-JS
const FILE_TYPES = [{ id: "inp", label: "INP" }];

export function SelectFileTypeField({ name }: { name: string }) {
  return (
    <Field
      as="select"
      name={name}
      aria-label="File format"
      className={styledSelect({ size: "md" }) + "w-full"}
    >
      {FILE_TYPES.map((type) => (
        <option key={type.id} value={type.id}>
          {type.label}
        </option>
      ))}
    </Field>
  );
}

export function SelectFileType() {
  const name = "type";

  return (
    <>
      <label className="block pt-2 space-y-2">
        <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
          File format
          <a
            target="_blank"
            className="focus:underline hover:underline"
            rel="noreferrer"
            href="https://epanet.org"
          >
            <QuestionMarkCircledIcon className="mr-1 inline-block" />
            Help
          </a>
        </div>
        <SelectFileTypeField name={name} />
      </label>
      <ErrorMessage name={name} component={InlineError} />
    </>
  );
}
