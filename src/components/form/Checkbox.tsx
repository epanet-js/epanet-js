export const Checkbox = ({
  size = 4,
  disabled,
  ...props
}: { size?: number } & React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      type="checkbox"
      className={`
        w-${size} h-${size} text-purple-400 border-gray-300 rounded
        ${
          disabled
            ? "cursor-not-allowed bg-gray-200 opacity-50"
            : "cursor-pointer bg-gray-50 focus:ring-purple-500"
        }
      `}
      {...props}
    />
  );
};
