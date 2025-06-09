import toast, { Toaster } from "react-hot-toast";

export default function Notifications({
  duration = 5000,
  successDuration = 3000,
}: {
  duration?: number;
  successDuration?: number;
}) {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className:
          "dark:bg-gray-900 dark:text-white dark:ring-1 dark:ring-gray-500 rounded-md",
        duration,
        success: {
          duration: successDuration,
          iconTheme: {
            primary: "green",
            secondary: "white",
          },
        },
      }}
    />
  );
}

export const notify = {
  error: ({
    title,
    description,
    Icon,
    id,
    duration = 5000,
  }: {
    title: string;
    description?: string;
    Icon?: React.ElementType;
    id?: string;
    duration?: number;
  }) => {
    return toast.custom(
      () => (
        <div className="w-[400px] flex items-start p-4 bg-red-50 border border-red-200 rounded-lg shadow-md">
          {Icon && (
            <Icon className="h-8 w-8 text-red-500 mr-3" aria-hidden="true" />
          )}

          <div className="flex flex-col">
            <span className="text-base font-semibold text-red-700">
              {title}
            </span>
            {description && (
              <span className="text-sm text-red-600 mt-1">{description}</span>
            )}
          </div>
        </div>
      ),
      { id, duration },
    );
  },
};
