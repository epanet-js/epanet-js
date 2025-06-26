import React from "react";
import type { IWrappedFeature } from "src/types";
import { panelRawOpen } from "src/state/jotai";
import { Button, sharedOutline, TextWell } from "src/components/elements";
import { PanelDetailsCollapsible } from "src/components/panel-details";
import clsx from "clsx";

export function RawEditor({ feature }: { feature: IWrappedFeature }) {
  return (
    <PanelDetailsCollapsible title="GeoJSON" atom={panelRawOpen}>
      <>
        <div className={`${clsx(sharedOutline("default"))} rounded-sm`}>
          {JSON.stringify(feature, null, 2)}
        </div>
        <div className="pt-2">
          <TextWell size="xs">
            This editor edits this feature. You can copy & paste new GeoJSON
            features or feature collections under Menu →{" "}
            <Button onClick={() => {}} size="xs">
              Paste text
            </Button>
            .
          </TextWell>
        </div>
      </>
    </PanelDetailsCollapsible>
  );
}
