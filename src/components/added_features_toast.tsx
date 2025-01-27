import { toast } from "react-hot-toast";
import type { ConvertResult } from "src/lib/convert/utils";
import { pluralize } from "src/lib/utils";
import { Button } from "./elements";

export function AddedFeaturesToast({ result }: { result: ConvertResult }) {
  return (
    <div className="flex items-center justify-between flex-auto gap-x-4">
      <div className="text-md">Imported</div>
      {result.notes.length ? (
        <Button type="button" onClick={() => {}}>
          {pluralize("issue", result.notes.length)}
        </Button>
      ) : null}
    </div>
  );
}

export default function addedFeaturesToast(result: ConvertResult) {
  return toast.success(
    () => {
      return <AddedFeaturesToast result={result} />;
    },
    {
      duration: result.notes.length ? 10000 : 5000,
    },
  );
}
