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

export const notifyPromiseState = (
  promise: Promise<void>,
  {
    loading,
    success,
    error,
    duration = 2000,
  }: { loading: string; success: string; error: string; duration?: number },
) => {
  return toast.promise(
    promise,
    { loading, success, error },
    { success: { duration }, error: { duration } },
  );
};

export const notify = ({
  variant,
  title,
  description,
  Icon,
  id,
  duration = 5000,
  position = "top-center",
  dismissable = true,
  size = "auto",
}: {
  variant: "success" | "warning" | "error";
  title: string;
  description?: string;
  Icon?: React.ElementType;
  id?: string;
  duration?: number;
  position?: "top-center" | "bottom-right";
  dismissable?: boolean;
  size?: "auto" | "sm" | "md";
}) => {
  return toast.custom(
    (t) => (
      <div
        className={clsx(
          {
            "w-[420px]": size === "md",
            "w-[300px]": size === "sm",
            "w-auto": size === "auto",
          },
          "flex items-start p-3 border rounded-lg shadow-md",
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
            className={clsx("h-5 w-5 mr-3 flex-shrink-0", {
              "text-green-500": variant === "success",
              "text-red-500": variant === "error",
              "text-orange-500": variant === "warning",
            })}
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col flex-grow space-y-1">
          <span
            className={clsx("text-sm font-semibold", {
              "text-green-700": variant === "success",
              "text-orange-700": variant === "warning",
              "text-red-700": variant === "error",
            })}
          >
            {title}
          </span>
          {description && (
            <span
              className={clsx("text-sm", {
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
            className="ml-4 p-1 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Dismiss</span>
            <Cross1Icon />
          </button>
        )}
      </div>
    ),
    { id, duration, position },
  );
};
