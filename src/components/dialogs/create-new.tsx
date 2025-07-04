import { FileIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "../dialog";
import { Form, Formik } from "formik";
import { SimpleDialogActions } from "src/components/dialog";
import {
  Presets,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";
import {
  HeadlossFormula,
  headlossFormulas,
  initializeHydraulicModel,
} from "src/hydraulic-model";
import { usePersistence } from "src/lib/persistence/context";
import { useTranslate } from "src/hooks/use-translate";
import { Selector } from "../form/selector";
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/jotai";
import { headlossFormulasFullNames } from "src/hydraulic-model/asset-types/pipe";
import { useUserTracking } from "src/infra/user-tracking";

type SubmitProps = {
  unitsSpec: keyof Presets;
  headlossFormula: HeadlossFormula;
};

export const CreateNew = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const userTracking = useUserTracking();

  const handleSumbit = ({ unitsSpec, headlossFormula }: SubmitProps) => {
    const quantities = new Quantities(presets[unitsSpec]);
    const modelMetadata = { quantities };
    const hydraulicModel = initializeHydraulicModel({
      units: quantities.units,
      defaults: quantities.defaults,
      headlossFormula,
    });
    transactImport(hydraulicModel, modelMetadata, "Untitled");
    userTracking.capture({
      name: "newModel.completed",
      units: unitsSpec,
      headlossFormula,
    });
    setFileInfo(null);
    onClose();
  };
  return (
    <>
      <DialogHeader title={translate("newProject")} titleIcon={FileIcon} />
      <Formik
        onSubmit={handleSumbit}
        initialValues={
          {
            unitsSpec: "LPS",
            headlossFormula: "H-W",
          } as SubmitProps
        }
      >
        {({ values, setFieldValue }) => (
          <Form>
            <UnitsSystemSelector
              selected={values.unitsSpec}
              onChange={(specId) => setFieldValue("unitsSpec", specId)}
            />
            <HeadlossFormulaSelector
              selected={values.headlossFormula}
              onChange={(headlossFormula) =>
                setFieldValue("headlossFormula", headlossFormula)
              }
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
  selected: keyof Presets;
  onChange: (specId: keyof Presets) => void;
}) => {
  const translate = useTranslate();
  const options = Object.entries(presets).map(([presetId, spec]) => ({
    label: `${spec.name}: ${spec.description}`,
    value: presetId as keyof Presets,
  }));

  return (
    <label className="block pt-2 space-y-2 pb-3">
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

const HeadlossFormulaSelector = ({
  selected,
  onChange,
}: {
  selected: HeadlossFormula;
  onChange: (headlossFormula: HeadlossFormula) => void;
}) => {
  const translate = useTranslate();
  const options = Object.values(headlossFormulas).map((headlossFormula, i) => ({
    label: `${headlossFormulasFullNames[i]} (${headlossFormula})`,
    value: headlossFormula,
  }));

  return (
    <label className="block pt-2 space-y-2">
      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
        {translate("headlossFormula")}
      </div>

      <Selector
        options={options}
        tabIndex={0}
        selected={selected}
        onChange={onChange}
        ariaLabel={translate("headlossFormula")}
      />
    </label>
  );
};
