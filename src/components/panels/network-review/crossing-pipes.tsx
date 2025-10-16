import { CheckType, EmptyState, ToolDescription, ToolHeader } from "./common";

export const CrossingPipes = ({ onGoBack }: { onGoBack: () => void }) => {
  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={0}
        checkType={CheckType.crossingPipes}
      />

      <ToolDescription checkType={CheckType.crossingPipes} />
      <EmptyState checkType={CheckType.crossingPipes} />
    </div>
  );
};
