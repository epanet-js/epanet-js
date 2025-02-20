import { DialogHeader } from "../dialog";
import { translate } from "src/infra/i18n";
import { AckDialogAction } from "./simple_dialog_actions";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { ParserIssues } from "src/import/parse-inp";
import { isDebugOn } from "src/infra/debug-mode";

export const InpIssuesDialog = ({
  issues,
  onClose,
}: {
  issues: ParserIssues;
  onClose: () => void;
}) => {
  return (
    <>
      <DialogHeader
        title="Your INP is not fully supported"
        titleIcon={ExclamationTriangleIcon}
        variant="warning"
      />
      <div className="text-sm">
        <p className="pb-2">
          Some features of your INP file are not fully supported yet. But don’t
          worry—more features are being added every day! 🚀
        </p>
        <p>
          Stay up to date with the latest updates and new features by
          subscribing to our newsletter!
        </p>
        {isDebugOn && (
          <>
            {issues.extendedPeriodSimulation && (
              <p>Extended period simulation</p>
            )}
            {issues.patternStartNotInZero && <p>Pattern start non zero</p>}
            {issues.unsupportedSections && (
              <p>
                Unsupported sections:{" "}
                {JSON.stringify(Array.from(issues.unsupportedSections))}
              </p>
            )}
            {issues.nodesMissingCoordinates && (
              <p>
                Missing coordinates:{" "}
                {JSON.stringify(Array.from(issues.nodesMissingCoordinates))}
              </p>
            )}
            {issues.invalidCoordinates && (
              <p>
                Invalid coordinates:{" "}
                {JSON.stringify(Array.from(issues.invalidCoordinates))}
              </p>
            )}
            {issues.nonDefaultOptions && (
              <p>
                Non default options:{" "}
                {JSON.stringify(Array.from(issues.nonDefaultOptions))}
              </p>
            )}
            {issues.accuracyDiff && (
              <p>Different accuracy: {JSON.stringify(issues.accuracyDiff)}</p>
            )}
            {issues.unbalancedDiff && (
              <p>
                Different unbalanced: {JSON.stringify(issues.unbalancedDiff)}
              </p>
            )}
          </>
        )}
      </div>
      <AckDialogAction label={translate("understood")} onAck={onClose} />
    </>
  );
};
