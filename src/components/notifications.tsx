import clsx from "clsx";
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

export const hideNotification = (id: string) => toast.remove(id);

export const notify = ({
  variant,
  title,
  description,
  Icon,
  id,
  duration = 5000,
}: {
  variant: "success" | "warning" | "error";
  title: string;
  description?: string;
  Icon?: React.ElementType;
  id?: string;
  duration?: number;
}) => {
  return toast.custom(
    () => (
      <div
        className={clsx(
          "w-[420px] flex items-start p-4 border rounded-lg shadow-md",
          {
            "bg-green-50 border-green-200": variant === "success",
            "bg-orange-50 border-orange-200": variant === "warning",
            "bg-red-50 border-red-200": variant === "error",
          },
        )}
      >
        {Icon && (
          <Icon
            className={clsx("h-8 w-8 mr-3", {
              "text-green-500": variant === "success",
              "text-red-500": variant === "error",
              "text-orange-500": variant === "warning",
            })}
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col">
          <span
            className={clsx("text-base font-semibold", {
              "text-green-700": variant === "success",
              "text-orange-700": variant === "warning",
              "text-red-700": variant === "error",
            })}
          >
            {title}
          </span>
          {description && (
            <span
              className={clsx("text-sm mt-1", {
                "text-green-600": variant === "success",
                "text-orange-600": variant === "warning",
                "text-red-600": variant === "error",
              })}
            >
              {description}
            </span>
          )}
        </div>
      </div>
    ),
    { id, duration },
  );
};
