import { FileIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { Field, Form, Formik } from "formik";
import SimpleDialogActions from "./simple_dialog_actions";
import {
  AssetQuantitiesSpec,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";
import { initializeHydraulicModel } from "src/hydraulic-model";
import { usePersistence } from "src/lib/persistence/context";
import { styledSelect } from "../elements";

export const CreateNew = ({ onClose }: { onClose: () => void }) => {
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();

  const handleSumbit = ({
    unitsSystem,
  }: {
    unitsSystem: "si" | "usCustomary";
  }) => {
    const quantities = new Quantities(presets[unitsSystem]);
    const modelMetadata = { quantities };
    const hydraulicModel = initializeHydraulicModel({
      units: quantities.units,
      defaults: quantities.defaults,
    });
    transactImport(hydraulicModel, modelMetadata, "Untitled");
    onClose();
  };
  return (
    <>
      <DialogHeader title="Create new" titleIcon={FileIcon} />
      <Formik
        onSubmit={handleSumbit}
        initialValues={{
          unitsSystem: "si",
        }}
      >
        <Form>
          <UnitsSystemSelector />
          <SimpleDialogActions onClose={onClose} action="Create" />
        </Form>
      </Formik>
    </>
  );
};

const UnitsSystemSelector = () => {
  return (
    <label className="block pt-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        Units system
      </div>

      <Field
        as="select"
        name="unitsSystem"
        aria-label={"unitsSystem"}
        className={styledSelect({ size: "md" }) + "w-full"}
      >
        {Object.keys(presets).map((presetId: AssetQuantitiesSpec["id"]) => (
          <option key={presetId} value={presetId}>
            {presets[presetId].name}
          </option>
        ))}
      </Field>
    </label>
  );
};
