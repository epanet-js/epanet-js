import clsx from "clsx";
import { styledPanelTitle } from "./elements";
import * as C from "@radix-ui/react-collapsible";
import React from "react";
import { useAtom } from "jotai";
import { PanelAtom } from "src/state/jotai";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";

export function PanelDetails({
  children,
  accessory,
  variant = "default",
  title,
}: {
  children: React.ReactNode;
  accessory?: React.ReactNode;
  variant?: "default" | "fullwidth";
  title: string;
}) {
  return (
    <div>
      <div className={styledPanelTitle({})}>
        {title}
        {accessory}
      </div>
      <div
        className={clsx(
          {
            "px-3": variant === "default",
          },
          `pb-3 contain-layout`,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function PanelDetailsCollapsible({
  title,
  children,
  atom,
}: React.PropsWithChildren<{
  title: string;
  atom: PanelAtom;
}>) {
  const [open, setOpen] = useAtom(atom);
  return (
    <C.Root open={open} onOpenChange={setOpen}>
      <C.Trigger className={styledPanelTitle({ interactive: true })}>
        <span>{title}</span>
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}{" "}
      </C.Trigger>
      <C.Content className="px-3 pb-3 contain-layout">{children}</C.Content>
    </C.Root>
  );
}
