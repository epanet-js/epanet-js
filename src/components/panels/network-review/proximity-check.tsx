import { CheckType, EmptyState, ToolHeader } from "./common";

export const ProximityCheck = ({ onGoBack }: { onGoBack: () => void }) => {
  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={0}
        checkType={CheckType.proximityCheck}
      />
      <EmptyState checkType={CheckType.proximityCheck} />
    </div>
  );
};
