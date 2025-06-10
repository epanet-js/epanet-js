import { Cross1Icon } from "@radix-ui/react-icons";
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
  position = "top-center",
  dismissable = true,
}: {
  variant: "success" | "warning" | "error";
  title: string;
  description?: string;
  Icon?: React.ElementType;
  id?: string;
  duration?: number;
  position?: "top-center" | "bottom-right";
  dismissable?: boolean;
}) => {
  return toast.custom(
    (t) => (
      <div
        className={clsx(
          "w-[420px] flex items-start p-4 border rounded-lg shadow-md",
          {
            "bg-green-50 border-green-200": variant === "success",
            "bg-orange-50 border-orange-200": variant === "warning",
            "bg-red-50 border-red-200": variant === "error",
          },
          t.visible ? "animate-enter" : "animate-leave",
        )}
      >
        {Icon && (
          <Icon
            className={clsx("h-6 w-6 mr-3", {
              "text-green-500": variant === "success",
              "text-red-500": variant === "error",
              "text-orange-500": variant === "warning",
            })}
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col flex-grow">
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
        {dismissable && (
          <button
            onClick={() => toast.remove(t.id)}
            className="ml-4 p-1 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Dismiss</span>
            <Cross1Icon className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
    { id, duration, position },
  );
};
