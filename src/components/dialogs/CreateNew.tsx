import { FileIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { Form, Formik } from "formik";
import SimpleDialogActions from "./simple_dialog_actions";
import {
  AssetQuantitiesSpec,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";
import { initializeHydraulicModel } from "src/hydraulic-model";
import { usePersistence } from "src/lib/persistence/context";
import { translate } from "src/infra/i18n";
import { Selector } from "../form/Selector";

type SubmitProps = {
  unitsSpec: AssetQuantitiesSpec["id"];
};

export const CreateNew = ({ onClose }: { onClose: () => void }) => {
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();

  const handleSumbit = ({ unitsSpec }: SubmitProps) => {
    const quantities = new Quantities(presets[unitsSpec]);
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
      <DialogHeader title={translate("newProject")} titleIcon={FileIcon} />
      <Formik
        onSubmit={handleSumbit}
        initialValues={
          {
            unitsSpec: "lps",
          } as SubmitProps
        }
      >
        {({ values, setFieldValue }) => (
          <Form>
            <UnitsSystemSelector
              selected={values.unitsSpec}
              onChange={(specId) => setFieldValue("unitsSpec", specId)}
            />
            <SimpleDialogActions
              onClose={onClose}
              action={translate("create")}
            />
          </Form>
        )}
      </Formik>
    </>
  );
};
const UnitsSystemSelector = ({
  selected,
  onChange,
}: {
  selected: AssetQuantitiesSpec["id"];
  onChange: (specId: AssetQuantitiesSpec["id"]) => void;
}) => {
  const options = Object.keys(presets).map(
    (presetId: AssetQuantitiesSpec["id"]) => ({
      label: `${presets[presetId].name}: ${presets[presetId].description}`,
      value: presetId,
    }),
  );

  return (
    <label className="block pt-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {translate("unitsSystem")}
      </div>

      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("unitsSystem")}
      />
    </label>
  );
};
