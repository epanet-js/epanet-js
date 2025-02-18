export const Checkbox = ({
  size = 4,
  ...props
}: {
  size: number & React.InputHTMLAttributes<HTMLInputElement>;
}) => {
  return (
    <input
      type="checkbox"
      className={`cursor-pointer w-${size} h-${size} text-purple-500 bg-gray-200 border-gray-300 rounded focus:ring-purple-500`}
      {...props}
    />
  );
};
