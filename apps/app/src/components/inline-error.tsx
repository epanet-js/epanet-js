"use client";
import { InfoIcon } from "src/icons";

export function InlineError({ children }: React.PropsWithChildren<unknown>) {
  return (
    <div
      role="alert"
      className="pt-1 flex items-start gap-x-1 text-size-base text-error"
    >
      <InfoIcon style={{ marginTop: 2 }} />
      {Array.isArray(children) ? children.join(", ") : children}
    </div>
  );
}
