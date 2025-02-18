export const Checkbox = ({
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      type="checkbox"
      className="cursor-pointer w-5 h-5 text-purple-500 bg-gray-200 border-gray-300 rounded focus:ring-purple-500"
      {...props}
    />
  );
};
