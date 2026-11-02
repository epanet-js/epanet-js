import { useAtomValue } from "jotai";
import { match } from "ts-pattern";
import { contentViewAtom } from "src/state/content-view";
import { ModelBuildView } from "./model-build-view";

export const ContentViews = () => {
  const contentView = useAtomValue(contentViewAtom);

  if (contentView === null) return null;

  const content = match(contentView)
    .with({ type: "modelBuild" }, () => <ModelBuildView />)
    .exhaustive();

  return (
    <div className="visible absolute -top-px inset-x-0 bottom-0 z-10 flex flex-col bg-popover border-t dark:border-gray-900">
      {content}
    </div>
  );
};
