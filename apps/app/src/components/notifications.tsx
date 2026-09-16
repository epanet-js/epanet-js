"use client";
import clsx from "clsx";
import toast, { Toaster } from "react-hot-toast";
import {
  Callout,
  type CalloutAction,
  type CalloutVariant,
} from "@epanet-js/ui-kit";

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
        className: "bg-base text-default ring-1 ring-subtle rounded-md",
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
  details,
  Icon,
  id,
  duration = 5000,
  position = "top-center",
  dismissable = true,
  size = "auto",
  action,
}: {
  variant?: CalloutVariant;
  title: string;
  description?: string;
  details?: string;
  Icon?: React.ElementType;
  id?: string;
  duration?: number;
  position?: "top-center" | "bottom-right" | "bottom-center";
  dismissable?: boolean;
  size?: "auto" | "sm" | "md";
  action?: CalloutAction;
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
        <Callout
          variant={variant}
          title={title}
          description={description}
          details={details}
          Icon={Icon}
          action={action}
          onActionClick={() => toast.remove(t.id)}
          onDismiss={dismissable ? () => toast.remove(t.id) : undefined}
          className="shadow-md border rounded-lg"
        />
      </div>
    ),
    { id, duration, position },
  );
};
