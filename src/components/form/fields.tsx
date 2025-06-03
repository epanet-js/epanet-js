import clsx from "clsx";

export const FieldList = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-y-2">{children}</div>;
};

export const InlineField = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center space-x-4">
      <label className={clsx(`max-w-[67px] w-full`, "text-sm text-gray-500")}>
        {name}
      </label>

      <div className="flex-1">{children}</div>
    </div>
  );
};

export const VerticalField = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-y-2 w-full">
    <span className="text-sm text-gray-500">{name}</span>
    {children}
  </div>
);
