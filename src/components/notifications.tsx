import clsx from "clsx";
import { CloseIcon } from "src/icons";
import toast, { Toaster } from "react-hot-toast";

type NotificationVariant = "success" | "warning" | "error" | "default";

type NotificationBannerProps = {
  variant: NotificationVariant;
  title?: string;
  description?: string;
  Icon?: React.ElementType;
  className?: string;
};

export const NotificationBanner = ({
  variant,
  title,
  description,
  Icon,
  className,
}: NotificationBannerProps) => {
  return (
    <div
      className={clsx(
        "flex items-start p-3",
        {
          "bg-green-50 border-green-200": variant === "success",
          "bg-orange-50 border-orange-200": variant === "warning",
          "bg-red-50 border-red-200": variant === "error",
          "bg-white borcer-gray-400": variant === "default",
        },
        className,
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
        {title && <span className="text-sm font-semibold">{title}</span>}
        {description && <span className="text-sm">{description}</span>}
      </div>
    </div>
  );
};

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
  variant = "default",
  title,
  description,
  Icon,
  id,
  duration = 5000,
  position = "top-center",
  dismissable = true,
  size = "auto",
}: {
  variant?: NotificationVariant;
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
          "relative",
          {
            "w-[420px]": size === "md",
            "w-[300px]": size === "sm",
            "w-auto": size === "auto",
          },
          t.visible ? "animate-enter" : "animate-leave",
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        data-notification
      >
        <NotificationBanner
          variant={variant}
          title={title}
          description={description}
          Icon={Icon}
          className={clsx(
            "shadow-md border rounded-lg",
            dismissable && "pr-10",
          )}
        />
        {dismissable && (
          <button
            onClick={() => toast.remove(t.id)}
            className="absolute top-3 right-3 p-1 rounded-md inline-flex items-center justify-center text-gray-700 hover:text-gray-500 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Dismiss</span>
            <CloseIcon />
          </button>
        )}
      </div>
    ),
    { id, duration, position },
  );
};
