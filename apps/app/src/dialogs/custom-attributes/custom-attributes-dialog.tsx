import { useState, useCallback, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { hasScenariosAtom } from "src/state/scenarios";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { changeCustomAttributesDefinition } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import { NotificationBanner } from "src/components/notifications";
import { VerticalResizer } from "../vertical-resizer";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { CustomAttributesSidebar } from "./custom-attributes-sidebar";
import { CustomAttributesTable } from "./custom-attributes-table";
import {
  buildCustomAttributeId,
  CustomAttribute,
  CustomAttributeAssetType,
  CustomAttributesDefinition,
  deepCloneCustomAttributes,
  getAttributes,
  hasDuplicateLabel,
  hasTooLongLabel,
  MAX_LABEL_LENGTH,
  nextIdSeed,
  setAttributes,
  totalAttributesCount,
} from "@epanet-js/hydraulic-model";

const ASSET_TYPE_ORDER: CustomAttributeAssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
  "customerPoint",
];

const serialize = (definition: CustomAttributesDefinition): string =>
  JSON.stringify(
    ASSET_TYPE_ORDER.map((assetType) => [
      assetType,
      getAttributes(definition, assetType).map((attribute) => [
        attribute.id,
        attribute.label,
        attribute.type,
      ]),
    ]),
  );

const hasEmptyLabel = (attributes: CustomAttribute[]): boolean =>
  attributes.some((attribute) => !attribute.label.trim());

const collectNewAttributes = (
  saved: CustomAttributesDefinition,
  edited: CustomAttributesDefinition,
): CustomAttribute[] => {
  const attributes: CustomAttribute[] = [];
  for (const assetType of ASSET_TYPE_ORDER) {
    const savedLabelsById = new Map(
      getAttributes(saved, assetType).map((attribute) => [
        attribute.id,
        attribute.label,
      ]),
    );
    for (const attribute of getAttributes(edited, assetType)) {
      const previousLabel = savedLabelsById.get(attribute.id);
      if (previousLabel === undefined || previousLabel !== attribute.label) {
        attributes.push(attribute);
      }
    }
  }
  return attributes;
};

export const CustomAttributesDialog = ({
  initialAssetType,
}: {
  initialAssetType?: CustomAttributeAssetType;
}) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const savedDefinition = hydraulicModel.customAttributes;
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();
  const hasScenarios = useAtomValue(hasScenariosAtom);
  const isEditionBlocked = useIsEditionBlocked() || hasScenarios;

  const savedSnapshotRef = useRef<string>(serialize(savedDefinition));

  const [edited, setEdited] = useState<CustomAttributesDefinition>(() =>
    deepCloneCustomAttributes(savedDefinition),
  );
  const [selectedAssetType, setSelectedAssetType] =
    useState<CustomAttributeAssetType>(initialAssetType ?? ASSET_TYPE_ORDER[0]);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const idCounterRef = useRef<number>(nextIdSeed(savedDefinition));
  const dialogActions = useRef<DialogActionsHandle>(null);

  const makeId = useCallback(
    () => buildCustomAttributeId(idCounterRef.current++),
    [],
  );

  const selectedAttributes = useMemo(
    () => getAttributes(edited, selectedAssetType),
    [edited, selectedAssetType],
  );

  const savedAttributeIds = useMemo(
    () =>
      new Set(
        getAttributes(savedDefinition, selectedAssetType).map(
          (attribute) => attribute.id,
        ),
      ),
    [savedDefinition, selectedAssetType],
  );

  const handleTableChange = useCallback(
    (attributes: CustomAttribute[]) => {
      setEdited((prev) => setAttributes(prev, selectedAssetType, attributes));
    },
    [selectedAssetType],
  );

  const hasChanges = serialize(edited) !== savedSnapshotRef.current;

  const invalidAssetTypes = useMemo(() => {
    const set = new Set<CustomAttributeAssetType>();
    for (const assetType of ASSET_TYPE_ORDER) {
      const attributes = getAttributes(edited, assetType);
      if (
        hasEmptyLabel(attributes) ||
        hasDuplicateLabel(attributes) ||
        hasTooLongLabel(attributes)
      )
        set.add(assetType);
    }
    return set;
  }, [edited]);

  const isInvalid = invalidAssetTypes.size > 0;

  const selectedTypeHasEmptyLabel = useMemo(
    () => hasEmptyLabel(selectedAttributes),
    [selectedAttributes],
  );

  const selectedTypeHasDuplicateLabel = useMemo(
    () => hasDuplicateLabel(selectedAttributes),
    [selectedAttributes],
  );

  const selectedTypeHasTooLongLabel = useMemo(
    () => hasTooLongLabel(selectedAttributes),
    [selectedAttributes],
  );

  const handleSave = useCallback(() => {
    const applied = transact(
      changeCustomAttributesDefinition(hydraulicModel, edited),
    );
    if (!applied) return;

    const newAttributes = collectNewAttributes(savedDefinition, edited);
    userTracking.capture({
      name: "customAttributes.updated",
      count: totalAttributesCount(edited),
      newLabels: newAttributes.map((attribute) => attribute.label),
      newAttributeTypes: newAttributes.map((attribute) => attribute.type),
    });
  }, [hydraulicModel, savedDefinition, edited, transact, userTracking]);

  return (
    <BaseDialog
      title={translate("customAttributes.title")}
      size="lg"
      height="lg"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          onSave={handleSave}
          readOnly={isEditionBlocked}
          hasChanges={hasChanges}
          saveDisabled={isInvalid}
        />
      }
    >
      <div className="flex-1 flex min-h-0">
        <div className="shrink-0 flex">
          <CustomAttributesSidebar
            width={sidebarWidth}
            assetTypes={ASSET_TYPE_ORDER}
            definition={edited}
            selectedAssetType={selectedAssetType}
            invalidAssetTypes={invalidAssetTypes}
            onSelect={setSelectedAssetType}
          />
          <VerticalResizer
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 w-full pr-3 py-3 gap-2">
          <div className="flex-1 min-h-0 overflow-hidden">
            <CustomAttributesTable
              attributes={selectedAttributes}
              onChange={handleTableChange}
              makeId={makeId}
              readOnly={isEditionBlocked}
              lockedTypeIds={savedAttributeIds}
            />
          </div>
          <div
            className={clsx(
              "shrink-0",
              !selectedTypeHasEmptyLabel &&
                !selectedTypeHasTooLongLabel &&
                !selectedTypeHasDuplicateLabel &&
                "invisible",
            )}
            aria-hidden={
              !selectedTypeHasEmptyLabel &&
              !selectedTypeHasTooLongLabel &&
              !selectedTypeHasDuplicateLabel
            }
          >
            <NotificationBanner
              variant="warning"
              title={translate("customAttributes.invalidLabel")}
              description={
                selectedTypeHasEmptyLabel
                  ? translate("customAttributes.emptyLabelError")
                  : selectedTypeHasTooLongLabel
                    ? translate(
                        "customAttributes.labelTooLongError",
                        String(MAX_LABEL_LENGTH),
                      )
                    : translate("customAttributes.duplicateLabelError")
              }
              Icon={TriangleAlert}
            />
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};
