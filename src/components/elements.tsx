import Link from "next/link";
import classed from "classed-components";
import clsx from "clsx";
import type { ClassValue } from "clsx";
import { Field } from "formik";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DD from "@radix-ui/react-dropdown-menu";
import * as CM from "@radix-ui/react-context-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as S from "@radix-ui/react-switch";
import { ErrorBoundary, captureError } from "src/infra/error-tracking";
import * as Select from "@radix-ui/react-select";
import React from "react";
import {
  SymbolIcon,
  Cross1Icon,
  QuestionMarkCircledIcon,
  ClipboardCopyIcon,
  EyeNoneIcon,
  EyeOpenIcon,
  TextIcon,
  TextNoneIcon,
  DrawingPinIcon,
  DrawingPinFilledIcon,
} from "@radix-ui/react-icons";
import { SUPPORT_EMAIL } from "src/lib/constants";
import Placemark from "./icons/placemark";
import { toast } from "react-hot-toast";
import { Portal } from "@radix-ui/react-portal";
import { translate } from "src/infra/i18n";

export function CopiableURL({ url }: { url: string }) {
  return (
    <div className="flex gap-x-2 items-stretch">
      <Input readOnly value={url} />
      <Button
        variant="quiet"
        onClick={() => {
          navigator.clipboard
            .writeText(url)
            .then(() => {
              toast("Copied");
            })
            .catch(() => {
              toast.error("Could not copy");
            });
        }}
      >
        <ClipboardCopyIcon />
      </Button>
    </div>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger className="dark:text-white align-middle">
        <QuestionMarkCircledIcon />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <TContent>
          <div className="w-36">{children}</div>
        </TContent>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function SiteIcon({}: React.HTMLAttributes<SVGElement>) {
  return (
    <svg width="32" height="32" version="1.1" viewBox="6 5 22 22">
      <path
        d="m16.133 2.1196a14 14 0 0 0-14 14 14 14 0 0 0 14 14 14 14 0 0 0 14-14 14 14 0 0 0-14-14zm-0.16016 4.0215a10 10 0 0 1 0.01953 0 10 10 0 0 1 0.01953 0 10 10 0 0 1 0.26562 0.00391 10 10 0 0 1 0.26563 0.011719 10 10 0 0 1 0.26562 0.017578 10 10 0 0 1 0.26367 0.025391 10 10 0 0 1 0.26562 0.033203 10 10 0 0 1 0.26172 0.039062 10 10 0 0 1 0.26172 0.046875 10 10 0 0 1 0.26172 0.052734 10 10 0 0 1 0.25781 0.060547 10 10 0 0 1 0.25781 0.066406 10 10 0 0 1 0.25586 0.074219 10 10 0 0 1 0.25391 0.080078 10 10 0 0 1 0.25 0.087891 10 10 0 0 1 0.25 0.09375 10 10 0 0 1 0.24609 0.099609 10 10 0 0 1 0.24219 0.10742 10 10 0 0 1 0.24023 0.11328 10 10 0 0 1 0.23828 0.11914 10 10 0 0 1 0.23438 0.12695 10 10 0 0 1 0.23047 0.13086 10 10 0 0 1 0.22656 0.13867 10 10 0 0 1 0.22461 0.14453 10 10 0 0 1 0.21875 0.15039 10 10 0 0 1 0.21484 0.15625 10 10 0 0 1 0.21094 0.16211 10 10 0 0 1 0.20703 0.16602 10 10 0 0 1 0.20312 0.17383 10 10 0 0 1 0.19727 0.17773 10 10 0 0 1 0.19336 0.18359 10 10 0 0 1 0.1875 0.1875 10 10 0 0 1 0.18164 0.19336 10 10 0 0 1 0.17773 0.19727 10 10 0 0 1 0.17188 0.20312 10 10 0 0 1 0.16797 0.20703 10 10 0 0 1 0.16016 0.21094 10 10 0 0 1 0.15625 0.2168 10 10 0 0 1 0.15039 0.21875 10 10 0 0 1 0.14258 0.22461 10 10 0 0 1 0.13867 0.22656 10 10 0 0 1 0.13086 0.23047 10 10 0 0 1 0.12695 0.23438 10 10 0 0 1 0.11914 0.23828 10 10 0 0 1 0.11328 0.24023 10 10 0 0 1 0.10547 0.24414 10 10 0 0 1 0.09961 0.24609 10 10 0 0 1 0.09375 0.24805 10 10 0 0 1 0.08789 0.25195 10 10 0 0 1 0.08008 0.25391 10 10 0 0 1 0.07227 0.25586 10 10 0 0 1 0.06641 0.25781 10 10 0 0 1 0.06055 0.25781 10 10 0 0 1 0.05273 0.26172 10 10 0 0 1 0.04492 0.26172 10 10 0 0 1 0.03906 0.26367 10 10 0 0 1 0.03125 0.26367 10 10 0 0 1 0.02539 0.26367 10 10 0 0 1 0.01758 0.26562 10 10 0 0 1 0.0098 0.26562 10 10 0 0 1 0.0039 0.26562 10 10 0 0 1 0 0.01953 10 10 0 0 1-0.0039 0.26562 10 10 0 0 1-0.01172 0.26562 10 10 0 0 1-0.01758 0.26562 10 10 0 0 1-0.02539 0.26562 10 10 0 0 1-0.03125 0.26367 10 10 0 0 1-0.03906 0.26172 10 10 0 0 1-0.04687 0.26172 10 10 0 0 1-0.05273 0.26172 10 10 0 0 1-0.06055 0.25781 10 10 0 0 1-0.06641 0.25781 10 10 0 0 1-0.07422 0.25586 10 10 0 0 1-0.08008 0.25391 10 10 0 0 1-0.08789 0.25 10 10 0 0 1-0.09375 0.25 10 10 0 0 1-0.10156 0.24609 10 10 0 0 1-0.10547 0.24219 10 10 0 0 1-0.11328 0.24219 10 10 0 0 1-0.12109 0.23633 10 10 0 0 1-0.125 0.23438 10 10 0 0 1-0.13281 0.23047 10 10 0 0 1-0.13867 0.22656 10 10 0 0 1-0.14453 0.22461 10 10 0 0 1-0.15039 0.21875 10 10 0 0 1-0.1543 0.21484 10 10 0 0 1-0.16211 0.21094 10 10 0 0 1-0.16797 0.20703 10 10 0 0 1-0.17187 0.20312 10 10 0 0 1-0.17774 0.19727 10 10 0 0 1-0.18359 0.19336 10 10 0 0 1-0.1875 0.1875 10 10 0 0 1-0.19336 0.18359 10 10 0 0 1-0.19922 0.17578 10 10 0 0 1-0.20117 0.17383 10 10 0 0 1-0.20703 0.16602 10 10 0 0 1-0.21289 0.16211 10 10 0 0 1-0.21484 0.1543 10 10 0 0 1-0.21875 0.15039 10 10 0 0 1-0.22461 0.14453 10 10 0 0 1-0.22656 0.13672 10 10 0 0 1-0.23242 0.13281 10 10 0 0 1-0.23438 0.125 10 10 0 0 1-0.23633 0.11914 10 10 0 0 1-0.24219 0.11328 10 10 0 0 1-0.24219 0.10547 10 10 0 0 1-0.24609 0.10156 10 10 0 0 1-0.25 0.0918 10 10 0 0 1-0.25195 0.08789 10 10 0 0 1-0.25195 0.08008 10 10 0 0 1-0.25586 0.07227 10 10 0 0 1-0.25781 0.06641 10 10 0 0 1-0.25977 0.06055 10 10 0 0 1-0.25976 0.05273 10 10 0 0 1-0.26172 0.04492 10 10 0 0 1-0.26367 0.03906 10 10 0 0 1-0.26367 0.03125 10 10 0 0 1-0.26562 0.02539 10 10 0 0 1-0.26562 0.01758 10 10 0 0 1-0.26562 0.01172 10 10 0 0 1-0.26562 2e-3 10 10 0 0 1-0.01953 0 10 10 0 0 1-0.26562-0.0039 10 10 0 0 1-0.26562-0.0098 10 10 0 0 1-0.26562-0.01953 10 10 0 0 1-0.26367-0.02539 10 10 0 0 1-0.26367-0.03125 10 10 0 0 1-0.26367-0.03906 10 10 0 0 1-0.26172-0.04687 10 10 0 0 1-0.25977-0.05273 10 10 0 0 1-0.25977-0.06055 10 10 0 0 1-0.25781-0.06641 10 10 0 0 1-0.25391-0.07422 10 10 0 0 1-0.25391-0.08008 10 10 0 0 1-0.25195-0.08789 10 10 0 0 1-0.24805-0.09375 10 10 0 0 1-0.24609-0.09961 10 10 0 0 1-0.24414-0.10742 10 10 0 0 1-0.24023-0.11328 10 10 0 0 1-0.23828-0.12109 10 10 0 0 1-0.23242-0.125 10 10 0 0 1-0.23242-0.13281 10 10 0 0 1-0.22656-0.13867 10 10 0 0 1-0.22266-0.14258 10 10 0 0 1-0.2207-0.15039 10 10 0 0 1-0.21484-0.15625 10 10 0 0 1-0.21094-0.16211 10 10 0 0 1-0.20703-0.16797 10 10 0 0 1-0.20117-0.17188 10 10 0 0 1-0.19922-0.17773 10 10 0 0 1-0.19141-0.18359 10 10 0 0 1-0.1875-0.1875 10 10 0 0 1-0.18359-0.19336 10 10 0 0 1-0.17774-0.19727 10 10 0 0 1-0.17188-0.20312 10 10 0 0 1-0.16602-0.20703 10 10 0 0 1-0.16211-0.21094 10 10 0 0 1-0.15625-0.2168 10 10 0 0 1-0.14844-0.21875 10 10 0 0 1-0.14453-0.22461 10 10 0 0 1-0.13867-0.22656 10 10 0 0 1-0.13086-0.23047 10 10 0 0 1-0.125-0.23438 10 10 0 0 1-0.12109-0.23828 10 10 0 0 1-0.11133-0.24023 10 10 0 0 1-0.10742-0.24414 10 10 0 0 1-0.09961-0.24609 10 10 0 0 1-0.09375-0.25 10 10 0 0 1-0.08594-0.25 10 10 0 0 1-0.08008-0.25391 10 10 0 0 1-0.07422-0.25586 10 10 0 0 1-0.06641-0.25781 10 10 0 0 1-0.05859-0.25977 10 10 0 0 1-0.05273-0.25977 10 10 0 0 1-0.04687-0.26172 10 10 0 0 1-0.03906-0.26367 10 10 0 0 1-0.03125-0.26367 10 10 0 0 1-0.02539-0.26562 10 10 0 0 1-0.01758-0.26367 10 10 0 0 1-0.0098-0.26758 10 10 0 0 1-0.0039-0.26562 10 10 0 0 1 0.0039-0.26562 10 10 0 0 1 0.0098-0.26562 10 10 0 0 1 0.01758-0.26367 10 10 0 0 1 0.02539-0.26562 10 10 0 0 1 0.03125-0.26367 10 10 0 0 1 0.03906-0.26367 10 10 0 0 1 0.04687-0.26172 10 10 0 0 1 0.05273-0.25976 10 10 0 0 1 0.05859-0.25977 10 10 0 0 1 0.06641-0.25781 10 10 0 0 1 0.07422-0.25586 10 10 0 0 1 0.08008-0.25391 10 10 0 0 1 0.08594-0.25 10 10 0 0 1 0.09375-0.25 10 10 0 0 1 0.09961-0.24609 10 10 0 0 1 0.10742-0.24414 10 10 0 0 1 0.11133-0.24023 10 10 0 0 1 0.11914-0.23828 10 10 0 0 1 0.12695-0.23438 10 10 0 0 1 0.13086-0.23047 10 10 0 0 1 0.13867-0.22656 10 10 0 0 1 0.14258-0.22461 10 10 0 0 1 0.15039-0.21875 10 10 0 0 1 0.15625-0.2168 10 10 0 0 1 0.16016-0.21094 10 10 0 0 1 0.16797-0.20703 10 10 0 0 1 0.17188-0.20312 10 10 0 0 1 0.17774-0.19727 10 10 0 0 1 0.18164-0.19336 10 10 0 0 1 0.18945-0.1875 10 10 0 0 1 0.19137-0.18363 10 10 0 0 1 0.19726-0.17773 10 10 0 0 1 0.20312-0.17383 10 10 0 0 1 0.20703-0.16602 10 10 0 0 1 0.21094-0.16211 10 10 0 0 1 0.21484-0.15625 10 10 0 0 1 0.2207-0.15039 10 10 0 0 1 0.22266-0.14453 10 10 0 0 1 0.22656-0.13672 10 10 0 0 1 0.23047-0.13281 10 10 0 0 1 0.23438-0.12695 10 10 0 0 1 0.23828-0.11914 10 10 0 0 1 0.24023-0.11328 10 10 0 0 1 0.24219-0.10742 10 10 0 0 1 0.24805-0.099609 10 10 0 0 1 0.24805-0.09375 10 10 0 0 1 0.25195-0.087891 10 10 0 0 1 0.25195-0.080078 10 10 0 0 1 0.25586-0.074219 10 10 0 0 1 0.25781-0.066406 10 10 0 0 1 0.25781-0.060547 10 10 0 0 1 0.26172-0.052734 10 10 0 0 1 0.26172-0.046875 10 10 0 0 1 0.26367-0.039062 10 10 0 0 1 0.26367-0.033203 10 10 0 0 1 0.26367-0.025391 10 10 0 0 1 0.26562-0.017578 10 10 0 0 1 0.26562-0.011719 10 10 0 0 1 0.26562-0.00391zm0 0a10 10 0 0 0-0.26562 0.00391 10 10 0 0 0-0.26562 0.011719 10 10 0 0 0-0.26562 0.017578 10 10 0 0 0-0.26367 0.025391 10 10 0 0 0-0.26367 0.033203 10 10 0 0 0-0.26367 0.039062 10 10 0 0 0-0.26172 0.046875 10 10 0 0 0-0.26172 0.052734 10 10 0 0 0-0.25781 0.060547 10 10 0 0 0-0.25781 0.066406 10 10 0 0 0-0.25586 0.074219 10 10 0 0 0-0.25195 0.080078 10 10 0 0 0-0.25195 0.087891 10 10 0 0 0-0.24805 0.09375 10 10 0 0 0-0.24805 0.099609 10 10 0 0 0-0.24219 0.10742 10 10 0 0 0-0.24023 0.11328 10 10 0 0 0-0.23828 0.11914 10 10 0 0 0-0.23438 0.12695 10 10 0 0 0-0.23047 0.13281 10 10 0 0 0-0.22656 0.13672 10 10 0 0 0-0.22266 0.14453 10 10 0 0 0-0.2207 0.15039 10 10 0 0 0-0.21484 0.15625 10 10 0 0 0-0.21094 0.16211 10 10 0 0 0-0.20703 0.16602 10 10 0 0 0-0.20312 0.17383 10 10 0 0 0-0.19726 0.17773 10 10 0 0 0-0.19141 0.18359 10 10 0 0 0-0.18945 0.1875 10 10 0 0 0-0.18164 0.19336 10 10 0 0 0-0.17774 0.19727 10 10 0 0 0-0.17188 0.20312 10 10 0 0 0-0.16797 0.20703 10 10 0 0 0-0.16016 0.21094 10 10 0 0 0-0.15625 0.2168 10 10 0 0 0-0.15039 0.21875 10 10 0 0 0-0.14258 0.22461 10 10 0 0 0-0.13867 0.22656 10 10 0 0 0-0.13086 0.23047 10 10 0 0 0-0.12695 0.23438 10 10 0 0 0-0.11914 0.23828 10 10 0 0 0-0.11133 0.24024 10 10 0 0 0-0.10742 0.24414 10 10 0 0 0-0.09961 0.24609 10 10 0 0 0-0.09375 0.25 10 10 0 0 0-0.08594 0.25 10 10 0 0 0-0.08008 0.25391 10 10 0 0 0-0.07422 0.25586 10 10 0 0 0-0.06641 0.25781 10 10 0 0 0-0.05859 0.25977 10 10 0 0 0-0.05273 0.25976 10 10 0 0 0-0.04687 0.26172 10 10 0 0 0-0.03906 0.26367 10 10 0 0 0-0.03125 0.26367 10 10 0 0 0-0.02539 0.26562 10 10 0 0 0-0.01758 0.26367 10 10 0 0 0-0.0098 0.26562 10 10 0 0 0-0.0039 0.26562 10 10 0 0 0 0.0039 0.26562 10 10 0 0 0 0.0098 0.26758 10 10 0 0 0 0.01758 0.26367 10 10 0 0 0 0.02539 0.26562 10 10 0 0 0 0.03125 0.26367 10 10 0 0 0 0.03906 0.26367 10 10 0 0 0 0.04687 0.26172 10 10 0 0 0 0.05273 0.25977 10 10 0 0 0 0.05859 0.25977 10 10 0 0 0 0.06641 0.25781 10 10 0 0 0 0.07422 0.25586 10 10 0 0 0 0.08008 0.25391 10 10 0 0 0 0.08594 0.25 10 10 0 0 0 0.09375 0.25 10 10 0 0 0 0.09961 0.24609 10 10 0 0 0 0.10742 0.24414 10 10 0 0 0 0.11133 0.24023 10 10 0 0 0 0.12109 0.23828 10 10 0 0 0 0.125 0.23438 10 10 0 0 0 0.13086 0.23047 10 10 0 0 0 0.13867 0.22656 10 10 0 0 0 0.14453 0.22461 10 10 0 0 0 0.14844 0.21875 10 10 0 0 0 0.15625 0.2168 10 10 0 0 0 0.16211 0.21094 10 10 0 0 0 0.16602 0.20703 10 10 0 0 0 0.17188 0.20312 10 10 0 0 0 0.17774 0.19727 10 10 0 0 0 0.18359 0.19336 10 10 0 0 0 0.1875 0.1875 10 10 0 0 0 0.19141 0.18359 10 10 0 0 0 0.19922 0.17773 10 10 0 0 0 0.20117 0.17188 10 10 0 0 0 0.20703 0.16797 10 10 0 0 0 0.21094 0.16211 10 10 0 0 0 0.21484 0.15625 10 10 0 0 0 0.2207 0.15039 10 10 0 0 0 0.22266 0.14258 10 10 0 0 0 0.22656 0.13867 10 10 0 0 0 0.23242 0.13281 10 10 0 0 0 0.23242 0.125 10 10 0 0 0 0.23828 0.12109 10 10 0 0 0 0.24023 0.11328 10 10 0 0 0 0.24414 0.10742 10 10 0 0 0 0.24609 0.09961 10 10 0 0 0 0.24805 0.09375 10 10 0 0 0 0.25195 0.08789 10 10 0 0 0 0.25391 0.08008 10 10 0 0 0 0.25391 0.07422 10 10 0 0 0 0.25781 0.06641 10 10 0 0 0 0.25977 0.06055 10 10 0 0 0 0.25977 0.05273 10 10 0 0 0 0.26172 0.04687 10 10 0 0 0 0.26367 0.03906 10 10 0 0 0 0.26367 0.03125 10 10 0 0 0 0.26367 0.02539 10 10 0 0 0 0.26562 0.01953 10 10 0 0 0 0.26562 0.0098 10 10 0 0 0 0.26562 0.0039 10 10 0 0 0 0.01953 0 10 10 0 0 0 0.26562-2e-3 10 10 0 0 0 0.26562-0.01172 10 10 0 0 0 0.26562-0.01758 10 10 0 0 0 0.26562-0.02539 10 10 0 0 0 0.26367-0.03125 10 10 0 0 0 0.26367-0.03906 10 10 0 0 0 0.26172-0.04492 10 10 0 0 0 0.25976-0.05273 10 10 0 0 0 0.25977-0.06055 10 10 0 0 0 0.25781-0.06641 10 10 0 0 0 0.25586-0.07227 10 10 0 0 0 0.25195-0.08008 10 10 0 0 0 0.25195-0.08789 10 10 0 0 0 0.25-0.0918 10 10 0 0 0 0.24609-0.10156 10 10 0 0 0 0.24219-0.10547 10 10 0 0 0 0.24219-0.11328 10 10 0 0 0 0.23633-0.11914 10 10 0 0 0 0.23438-0.125 10 10 0 0 0 0.23242-0.13281 10 10 0 0 0 0.22656-0.13672 10 10 0 0 0 0.22461-0.14453 10 10 0 0 0 0.21875-0.15039 10 10 0 0 0 0.21484-0.1543 10 10 0 0 0 0.21289-0.16211 10 10 0 0 0 0.20703-0.16602 10 10 0 0 0 0.20117-0.17383 10 10 0 0 0 0.19922-0.17578 10 10 0 0 0 0.19336-0.18359 10 10 0 0 0 0.1875-0.1875 10 10 0 0 0 0.18359-0.19336 10 10 0 0 0 0.17774-0.19727 10 10 0 0 0 0.17187-0.20312 10 10 0 0 0 0.16797-0.20703 10 10 0 0 0 0.16211-0.21094 10 10 0 0 0 0.1543-0.21484 10 10 0 0 0 0.15039-0.21875 10 10 0 0 0 0.14453-0.22461 10 10 0 0 0 0.13867-0.22656 10 10 0 0 0 0.13281-0.23047 10 10 0 0 0 0.125-0.23438 10 10 0 0 0 0.12109-0.23633 10 10 0 0 0 0.11328-0.24219 10 10 0 0 0 0.10547-0.24219 10 10 0 0 0 0.10156-0.24609 10 10 0 0 0 0.09375-0.25 10 10 0 0 0 0.08789-0.25 10 10 0 0 0 0.08008-0.25391 10 10 0 0 0 0.07422-0.25586 10 10 0 0 0 0.06641-0.25781 10 10 0 0 0 0.06055-0.25781 10 10 0 0 0 0.05273-0.26172 10 10 0 0 0 0.04687-0.26172 10 10 0 0 0 0.03906-0.26172 10 10 0 0 0 0.03125-0.26367 10 10 0 0 0 0.02539-0.26562 10 10 0 0 0 0.01758-0.26562 10 10 0 0 0 0.01172-0.26562 10 10 0 0 0 0.0039-0.26562 10 10 0 0 0 0-0.01953 10 10 0 0 0-0.0039-0.26562 10 10 0 0 0-0.0098-0.26562 10 10 0 0 0-0.01758-0.26562 10 10 0 0 0-0.02539-0.26367 10 10 0 0 0-0.03125-0.26367 10 10 0 0 0-0.03906-0.26367 10 10 0 0 0-0.04492-0.26172 10 10 0 0 0-0.05273-0.26172 10 10 0 0 0-0.06055-0.25781 10 10 0 0 0-0.06641-0.25781 10 10 0 0 0-0.07227-0.25586 10 10 0 0 0-0.08004-0.25388 10 10 0 0 0-0.08789-0.25195 10 10 0 0 0-0.09375-0.24805 10 10 0 0 0-0.09961-0.24609 10 10 0 0 0-0.10547-0.24414 10 10 0 0 0-0.11328-0.24024 10 10 0 0 0-0.11914-0.23828 10 10 0 0 0-0.12695-0.23438 10 10 0 0 0-0.13086-0.23047 10 10 0 0 0-0.13867-0.22656 10 10 0 0 0-0.14258-0.22461 10 10 0 0 0-0.15039-0.21875 10 10 0 0 0-0.15625-0.2168 10 10 0 0 0-0.16016-0.21094 10 10 0 0 0-0.16797-0.20703 10 10 0 0 0-0.17188-0.20312 10 10 0 0 0-0.17773-0.19727 10 10 0 0 0-0.18164-0.19336 10 10 0 0 0-0.1875-0.1875 10 10 0 0 0-0.19336-0.18359 10 10 0 0 0-0.19727-0.17773 10 10 0 0 0-0.20312-0.17383 10 10 0 0 0-0.20703-0.16602 10 10 0 0 0-0.21094-0.16211 10 10 0 0 0-0.21484-0.15625 10 10 0 0 0-0.21875-0.15039 10 10 0 0 0-0.22461-0.14453 10 10 0 0 0-0.22656-0.13867 10 10 0 0 0-0.23047-0.13086 10 10 0 0 0-0.23438-0.12695 10 10 0 0 0-0.23828-0.11914 10 10 0 0 0-0.24023-0.11328 10 10 0 0 0-0.24219-0.10742 10 10 0 0 0-0.24609-0.099609 10 10 0 0 0-0.25-0.09375 10 10 0 0 0-0.25-0.087891 10 10 0 0 0-0.25391-0.080078 10 10 0 0 0-0.25586-0.074219 10 10 0 0 0-0.25781-0.066406 10 10 0 0 0-0.25781-0.060547 10 10 0 0 0-0.26172-0.052734 10 10 0 0 0-0.26172-0.046875 10 10 0 0 0-0.26172-0.039062 10 10 0 0 0-0.26562-0.033203 10 10 0 0 0-0.26367-0.025391 10 10 0 0 0-0.26562-0.017578 10 10 0 0 0-0.26563-0.011719 10 10 0 0 0-0.26562-0.00391 10 10 0 0 0-0.01953 0 10 10 0 0 0-0.01953 0zm0.01953 1.3496s1.5 1.6875 3 3.875c0.75 1.0938 1.5 2.3125 2.0625 3.5078 0.5625 1.1953 0.9375 2.3672 0.9375 3.3672a6 6 0 0 1-0.0039 0.20703 6 6 0 0 1-0.0098 0.20508 6 6 0 0 1-0.01758 0.20508 6 6 0 0 1-0.02539 0.20508 6 6 0 0 1-0.03125 0.20312 6 6 0 0 1-0.03906 0.20312 6 6 0 0 1-0.04492 0.20117 6 6 0 0 1-0.05273 0.19726 6 6 0 0 1-0.05857 0.19727 6 6 0 0 1-0.06641 0.19531 6 6 0 0 1-0.07227 0.19336 6 6 0 0 1-0.08008 0.18945 6 6 0 0 1-0.08594 0.1875 6 6 0 0 1-0.0918 0.18555 6 6 0 0 1-0.09766 0.17969 6 6 0 0 1-0.10547 0.17774 6 6 0 0 1-0.10938 0.17383 6 6 0 0 1-0.11719 0.16992 6 6 0 0 1-0.12109 0.16602 6 6 0 0 1-0.12891 0.16211 6 6 0 0 1-0.13281 0.15625 6 6 0 0 1-0.13867 0.15234 6 6 0 0 1-0.14453 0.14844 6 6 0 0 1-0.14844 0.14258 6 6 0 0 1-0.15234 0.13672 6 6 0 0 1-0.1582 0.13086 6 6 0 0 1-0.16406 0.12695 6 6 0 0 1-0.16602 0.12109 6 6 0 0 1-0.17188 0.11524 6 6 0 0 1-0.17383 0.10937 6 6 0 0 1-0.17773 0.10352 6 6 0 0 1-0.18164 0.0957 6 6 0 0 1-0.18555 0.08984 6 6 0 0 1-0.1875 0.08594 6 6 0 0 1-0.19141 0.07617 6 6 0 0 1-0.19336 0.07227 6 6 0 0 1-0.19531 0.06445 6 6 0 0 1-0.19727 0.05664 6 6 0 0 1-0.20117 0.05078 6 6 0 0 1-0.20117 0.04492 6 6 0 0 1-0.20117 0.03711 6 6 0 0 1-0.20508 0.0293 6 6 0 0 1-0.20508 0.02344 6 6 0 0 1-0.20508 0.01563 6 6 0 0 1-0.20508 0.0078 6 6 0 0 1-0.15625 2e-3 6 6 0 0 1-0.20508-2e-3 6 6 0 0 1-0.20703-0.01172 6 6 0 0 1-0.20508-0.01758 6 6 0 0 1-0.20312-0.02539 6 6 0 0 1-0.20508-0.03125 6 6 0 0 1-0.20117-0.03906 6 6 0 0 1-0.20117-0.04492 6 6 0 0 1-0.19922-0.05273 6 6 0 0 1-0.19726-0.05859 6 6 0 0 1-0.19531-0.06641 6 6 0 0 1-0.19141-0.07227 6 6 0 0 1-0.19141-0.08008 6 6 0 0 1-0.1875-0.08594 6 6 0 0 1-0.18359-0.0918 6 6 0 0 1-0.18164-0.09766 6 6 0 0 1-0.17773-0.10547 6 6 0 0 1-0.17383-0.10938 6 6 0 0 1-0.16992-0.11719 6 6 0 0 1-0.16406-0.12109 6 6 0 0 1-0.16211-0.12891 6 6 0 0 1-0.1582-0.13281 6 6 0 0 1-0.15234-0.13867 6 6 0 0 1-0.14648-0.14453 6 6 0 0 1-0.14258-0.14844 6 6 0 0 1-0.13672-0.15234 6 6 0 0 1-0.13281-0.1582 6 6 0 0 1-0.12695-0.16211 6 6 0 0 1-0.12109-0.16797 6 6 0 0 1-0.11328-0.16992 6 6 0 0 1-0.10938-0.17578 6 6 0 0 1-0.10352-0.17773 6 6 0 0 1-0.09766-0.18164 6 6 0 0 1-0.08984-0.18555 6 6 0 0 1-0.08398-0.1875 6 6 0 0 1-0.07813-0.19141 6 6 0 0 1-0.07031-0.19336 6 6 0 0 1-0.06445-0.19531 6 6 0 0 1-0.05859-0.19727 6 6 0 0 1-0.05078-0.19922 6 6 0 0 1-0.04297-0.20117 6 6 0 0 1-0.03711-0.20312 6 6 0 0 1-0.0293-0.20508 6 6 0 0 1-0.02344-0.20312 6 6 0 0 1-0.01563-0.20703 6 6 0 0 1-0.0098-0.20508 6 6 0 0 1-2e-3 -0.15625c0-1 0.375-2.1719 0.9375-3.3672 0.5625-1.1953 1.3125-2.4141 2.0625-3.5078 1.5-2.1875 3-3.875 3-3.875z"
        fill="#262b2f00"
      ></path>
      <path
        d="m19.788 12.485-9.5406 4.0934c-0.24859 0.72547-0.24156 1.4072-0.24156 2.0341 3.83e-4 1.1536 0.48332 2.266 1.109 3.2353l10.814-4.7285c-0.39608-1.4629-1.1817-3.1468-2.1413-4.6343z"
        fill="#ccd3d8"
      ></path>
      <path
        d="m11.115 21.848c0.0026 0.0039 0.0052 0.0078 0.0078 0.01172 0.03742 0.05795 0.07584 0.11525 0.11523 0.17188 0.03941 0.05603 0.07979 0.11137 0.12109 0.16602 0.04072 0.0554 0.0824 0.1101 0.125 0.16406 0.04336 0.05349 0.08764 0.10624 0.13281 0.1582 0.0447 0.05156 0.09028 0.10234 0.13672 0.15234 0.04667 0.05029 0.09421 0.09978 0.14258 0.14844 0.04864 0.04903 0.09813 0.09721 0.14844 0.14453 0.04998 0.04709 0.10077 0.09332 0.15234 0.13867 0.05132 0.04516 0.10341 0.08943 0.15625 0.13281 0.05329 0.0439 0.10734 0.08687 0.16211 0.12891 0.05464 0.04131 0.10999 0.08168 0.16602 0.12109 0.05596 0.04003 0.11261 0.0791 0.16992 0.11719 0.05732 0.03745 0.11527 0.07391 0.17383 0.10938 0.05864 0.03617 0.11789 0.07134 0.17773 0.10547 0.05934 0.03357 0.11924 0.06613 0.17969 0.09766 0.06132 0.03167 0.12318 0.06227 0.18555 0.0918 0.06136 0.0297 0.12321 0.05835 0.18555 0.08594 0.06334 0.02779 0.12715 0.05449 0.19141 0.08008 0.06403 0.0252 0.1285 0.04929 0.19336 0.07227 0.06407 0.02323 0.12853 0.04537 0.19336 0.06641 0.06542 0.02066 0.13118 0.04019 0.19727 0.05859 0.0661 0.01872 0.13252 0.03629 0.19922 0.05273 0.06679 0.01612 0.13386 0.0311 0.20117 0.04492 0.06748 0.01419 0.1352 0.02721 0.20312 0.03906 0.06753 0.01158 0.13524 0.02199 0.20313 0.03125 0.06821 0.0096 0.13658 0.0181 0.20508 0.02539 0.06825 7e-3 0.13662 0.01289 0.20508 0.01758 0.0683 0.0044 0.13667 0.0077 0.20508 0.0098 0.06898 0.0025 0.138 0.0038 0.20703 0.0039 0.05144-5e-6 0.10288-6.72e-4 0.1543-2e-3 0.06905-0.0014 0.13807-4e-3 0.20703-0.0078 0.06846-0.0047 0.13682-0.01055 0.20508-0.01758 0.06848-6e-3 0.13685-0.01315 0.20508-0.02149 0.06788-0.0093 0.1356-0.01967 0.20312-0.03125 0.06792-0.0112 0.13564-0.02358 0.20313-0.03711 0.0673-0.01317 0.13436-0.0275 0.20117-0.04297 0.06669-0.01579 0.13311-0.03272 0.19922-0.05078 0.06609-0.0184 0.13185-0.03793 0.19727-0.05859 0.06547-0.02037 0.13058-0.04185 0.19531-0.06445 0.06485-0.02233 0.12931-0.04577 0.19336-0.07031 0.06425-0.02494 0.12806-0.05099 0.19141-0.07813 0.06298-0.02692 0.12548-0.05492 0.1875-0.08398 0.06236-0.02888 0.12422-0.05883 0.18555-0.08984 0.0611-0.03151 0.12166-0.06407 0.18164-0.09766 0.05982-0.03284 0.11907-0.0667 0.17774-0.10156 0.05922-0.03544 0.11782-0.07191 0.17578-0.10938 0.05729-0.03744 0.11394-0.07586 0.16992-0.11524 0.05668-0.0394 0.11268-0.07977 0.16797-0.12109 0.05476-0.04139 0.1088-0.08371 0.16211-0.12695 0.05348-0.04271 0.10622-0.08634 0.1582-0.13086 0.05223-0.04533 0.10367-0.09156 0.1543-0.13867 0.05029-0.04667 0.09978-0.09421 0.14844-0.14258 0.04836-0.04801 0.09589-0.09685 0.14258-0.14648 0.04709-0.04998 0.09332-0.10077 0.13867-0.15234 0.04516-0.05132 0.08944-0.10341 0.13281-0.15625 0.0439-0.05329 0.08687-0.10734 0.12891-0.16211 0.04131-0.05464 0.08168-0.10999 0.12109-0.16602 0.04003-0.05597 0.0791-0.11261 0.11719-0.16992 0.0381-0.0573 0.07522-0.11525 0.11133-0.17383 0.03552-0.05865 0.07003-0.1179 0.10352-0.17773 0.03359-0.05998 0.06615-0.12054 0.09766-0.18164 0.0323-0.06066 0.06355-0.12186 0.09375-0.18359 0.02972-0.062 0.05837-0.12451 0.08594-0.1875 0.02712-0.0627 0.05317-0.12586 0.07813-0.18945 0.0252-0.06403 0.04929-0.1285 0.07227-0.19336 0.02325-0.06472 0.04539-0.12983 0.06641-0.19531 0.02066-0.06542 0.04019-0.13118 0.05859-0.19726 0.01872-0.0661 0.03629-0.13252 0.05273-0.19922 0.01678-0.06678 0.0324-0.13385 0.04687-0.20117 0.01351-0.06684 0.02588-0.13391 0.03711-0.20117 0.01223-0.06751 0.0233-0.13523 0.0332-0.20312 9e-3 -0.06822 0.0168-0.13659 0.02344-0.20508 7e-3 -0.06825 0.01289-0.13662 0.01758-0.20508 0.0051-0.06829 9e-3 -0.13666 0.01172-0.20508 0.0025-0.06898 0.0038-0.138 0.0039-0.20703 0-0.41756-0.11139-1.0099-0.22851-1.4766z"
        fill="#aab6c1"
      ></path>
      <path
        d="m19.788 12.485c-0.24626-0.39251-0.54271-0.7499-0.79621-1.1196-1.5-2.1875-3-3.875-3-3.875s-1.5 1.6875-3 3.875c-0.75 1.0938-1.5 2.3125-2.0625 3.5078-0.28781 0.6116-0.51733 1.1258-0.68185 1.7052z"
        fill="#EAEDF0"
      ></path>
    </svg>
  );
}

export function StyledDropOverlayIndex({
  children,
}: React.PropsWithChildren<Record<string, unknown>>) {
  return (
    <Portal>
      <div className="absolute bottom-10 left-1/2">
        <div className="px-3 py-2 text-white bg-gray-500 rounded-md w-48 -m-24">
          {children}
        </div>
      </div>
    </Portal>
  );
}

export function StyledDropOverlay({
  children,
}: React.PropsWithChildren<Record<string, unknown>>) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-500 pointer-events-none bg-opacity-75">
      <div className="px-3 py-2 text-white bg-gray-500 rounded-md max-w-64">
        {children}
      </div>
    </div>
  );
}

type ErrorData = {
  error: unknown;
  componentStack: string;
  eventId: string;
  resetError(): void;
};

export function Badge({
  children,
  variant = "default",
}: React.PropsWithChildren<{
  variant?: B3Variant;
}>) {
  return (
    <div
      className={clsx(
        {
          "bg-purple-100 dark:bg-gray-700": variant === "default",
          "": variant === "quiet",
        },
        `inline-flex uppercase
    text-gray-700 dark:text-gray-100
    font-bold text-xs px-1.5 py-0.5 rounded`,
      )}
    >
      {children}
    </div>
  );
}

export function ErrorFallback(props: ErrorData) {
  return (
    <div className="max-w-xl p-4">
      <TextWell size="md">
        Sorry, an unexpected error occurred. The error’s already been
        automatically reported, but if you can let us know what happened, we can
        fix it even faster:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}&subject=Error (ID: ${
            props.eventId || "?"
          })`}
          className={styledInlineA}
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </TextWell>
      {props.resetError ? (
        <div className="pt-2">
          <Button onClick={() => props.resetError()}>Retry</Button>
        </div>
      ) : null}
    </div>
  );
}

export function DefaultErrorBoundary({
  children,
}: React.PropsWithChildren<unknown>) {
  return (
    <ErrorBoundary showDialog fallback={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}

export function Loading({
  size = "sm",
  text = translate("loading"),
}: {
  size?: B3Size;
  text?: string;
}) {
  return (
    <div
      className={clsx(
        {
          "h-32": size === "sm",
          "h-16": size === "xs",
        },
        `text-gray-500 flex items-center justify-center`,
      )}
    >
      <SymbolIcon className="animate-spin" />
      <span className="ml-2">{text}</span>
    </div>
  );
}

export const CapsLabel = classed.label(
  "block uppercase font-semibold text-gray-500 dark:text-gray-500 text-xs",
);

const overlayClasses =
  "fixed inset-0 bg-black/20 dark:bg-white/20 z-50 placemark-fadein";

export const StyledAlertDialogOverlay = classed(AlertDialog.Overlay)(
  overlayClasses,
);
export const StyledDialogOverlay = classed(Dialog.Overlay)(overlayClasses);

const styledDialogContent = ({
  size = "sm",
  widthClasses = "w-full sm:max-w-lg",
}: {
  size?: B3Size;
  widthClasses?: string;
}) =>
  clsx(
    {
      "p-4": size === "sm",
      "p-0": size === "xs",
    },
    `fixed inline-block
      max-h-[80vh]
      text-left
      align-bottom
      bg-white dark:bg-gray-900
      dark:text-white
      shadow-md dark:shadow-none dark:border dark:border-black
      sm:rounded sm:align-middle ${widthClasses}
      left-2/4 top-2/4 -translate-x-1/2 -translate-y-1/2
      overflow-y-auto placemark-scrollbar
      z-50
      `,
  );

const customWelcomeDialogContent = () => {
  return clsx(
    `fixed inline-block
      max-h-[720px]
      h-full
      w-[1024px]
      text-left
      align-bottom
      bg-white dark:bg-gray-900
      dark:text-white
      shadow-md dark:shadow-none dark:border dark:border-black
      sm:rounded sm:align-middle w-full
      left-2/4 top-2/4 -translate-x-1/2 -translate-y-1/2
      overflow-y-auto placemark-scrollbar
      p-0
      z-50
      `,
  );
};

export const StyledDialogContent = classed(Dialog.Content)(styledDialogContent);
export const WelcomeDialogContent = classed(Dialog.Content)(
  customWelcomeDialogContent,
);
export const StyledAlertDialogContent = classed(AlertDialog.Content)(
  styledDialogContent,
);

export const styledCheckbox = ({
  variant = "default",
}: {
  variant: B3Variant;
}) =>
  clsx([
    sharedOutline("primary"),
    {
      "text-purple-500 focus:ring-purple-500": variant === "primary",
      "text-gray-500 border-gray-500 hover:border-gray-700 dark:hover:border-gray-300 focus:ring-gray-500":
        variant === "default",
    },
    `bg-transparent rounded dark:ring-offset-gray-700`,
  ]);

export const FieldCheckbox = classed(Field)(styledCheckbox);

export const StyledDialogClose = () => (
  <Dialog.Close
    aria-label="Close"
    className="absolute top-4 right-4 text-gray-500"
  >
    <Cross1Icon />
  </Dialog.Close>
);

export const TContent = classed(Tooltip.Content)(
  ({ size = "sm" }: { size?: B3Size }) => [
    {
      "max-w-md": size === "sm",
      "w-64": size === "md",
    },
    `px-2 py-1 rounded
  z-50
  text-sm
  border
  shadow-sm
  text-gray-700          dark:text-white
  bg-white               dark:bg-gray-900
  border-gray-200        dark:border-gray-600
  `,
  ],
);

export function styledPropertyInput(
  side: "left" | "right" | "table",
  missing = false,
) {
  return clsx(
    {
      "pl-3": side === "left",
      "pl-2": side === "right",
      "px-2": side === "table",
    },
    missing
      ? "text-gray-700 dark:text-gray-100 opacity-70"
      : "text-gray-700 dark:text-gray-100",
    `bg-transparent block tabular-nums text-xs border-none pr-1 py-2
    w-full
    focus-visible:ring-inset
    focus-visible:bg-purple-300/10 dark:focus-visible:bg-purple-700/40
    dark:focus-visible:ring-purple-700 focus-visible:ring-purple-500`,
  );
}
export function styledPropertyInputWithError(
  side: "left" | "right" | "table",
  missing = false,
) {
  return clsx(
    {
      "pl-3": side === "left",
      "pl-2": side === "right",
      "px-2": side === "table",
    },
    missing
      ? "text-gray-700 dark:text-gray-100 opacity-70"
      : "text-gray-700 dark:text-gray-100",
    `bg-transparent block tabular-nums text-xs border-none pr-1 py-2
    w-full
    focus-visible:ring-inset
    focus-visible:bg-orange-300/10 dark:focus-visible:bg-orange-700/40
    dark:focus-visible:ring-orange-700 focus-visible:ring-orange-500`,
  );
}

export const styledTd = "border-gray-200 dark:border-gray-600";

const arrowLike = "text-white dark:text-gray-900 fill-current";

const ArrowSVG = (
  <svg>
    <polygon points="0,0 30,0 15,10" />
    <path
      d="M 0 0 L 15 10 L 30 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-gray-200 dark:text-gray-600"
    />
  </svg>
);

export const StyledPopoverArrow = () => (
  <Popover.Arrow offset={5} width={11} height={5} className={arrowLike} asChild>
    {ArrowSVG}
  </Popover.Arrow>
);

export const StyledTooltipArrow = () => (
  <Tooltip.Arrow offset={5} width={11} height={5} className={arrowLike} asChild>
    {ArrowSVG}
  </Tooltip.Arrow>
);

export const StyledDropDownArrow = () => (
  <DD.Arrow offset={5} width={11} height={5} className={arrowLike} asChild>
    {ArrowSVG}
  </DD.Arrow>
);

export const StyledPopoverContent = classed(Popover.Content)(
  ({
    size = "sm",
    flush = "no",
  }: {
    size?: B3Size | "no-width";
    flush?: "yes" | "no";
  }) =>
    clsx(
      {
        "w-32": size === "xs",
        "w-64": size === "sm",
        "w-96": size === "md",
        "w-[36em]": size === "lg",
      },
      flush === "yes" ? "" : "p-3",
      `shadow-lg
      placemark-appear
      z-50
      bg-white dark:bg-gray-900
      dark:text-white
      border border-gray-200 dark:border-gray-700 rounded-md`,
    ),
);

export function PopoverContent2({
  children,
  ...props
}: React.ComponentProps<typeof StyledPopoverContent>) {
  return (
    <Popover.Portal>
      <StyledPopoverContent {...props}>
        <StyledPopoverArrow />
        {children}
      </StyledPopoverContent>
    </Popover.Portal>
  );
}

export const styledTextarea =
  "block w-full mt-1 text-sm font-mono border-gray-300 dark:bg-transparent dark:text-white rounded-sm focus-visible:border-gray-300 overflow-auto focus:ring-purple-500";

export const StyledFieldTextareaCode = classed(Field)(styledTextarea);

export const StyledLabelSpan = classed.span(
  ({ size = "sm" }: { size?: B3Size }) =>
    clsx(
      {
        "text-sm": size === "sm",
        "text-xs": size === "xs",
      },
      "text-gray-700 dark:text-gray-300 select-none",
    ),
);

export const StyledFieldTextareaProse = classed(Field)(
  (
    {
      size = "md",
      variant = "default",
    }: { size: B3Size; variant: B3Variant } = {
      size: "sm",
      variant: "default",
    },
  ) =>
    clsx(
      sharedEqualPadding(size),
      sharedOutline(variant),
      "block w-full mt-1 focus-visible:border-gray-300 dark:bg-transparent dark:text-white",
    ),
);

export const contentLike = `py-1
    bg-white dark:bg-gray-900
    rounded-sm
    shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]
    ring-1 ring-gray-200 dark:ring-gray-700
    content-layout z-50`;

export const DDContent = classed(DD.Content)(contentLike);
export const DDSubContent = classed(DD.SubContent)(contentLike);
export const CMContent = classed(CM.Content)(contentLike);
export const CMSubContent = classed(CM.SubContent)(contentLike);

const styledLabel =
  "block py-1 pl-3 pr-4 text-xs text-gray-500 dark:text-gray-300";

export const DivLabel = classed.div(styledLabel);
export const DDLabel = classed(DD.Label)(styledLabel);
export const StyledSelectLabel = classed(Select.Label)(styledLabel);

const styledSeparator = "border-t border-gray-100 dark:border-gray-700 my-1";

export const DivSeparator = classed.div(styledSeparator);
export const DDSeparator = classed(DD.Separator)(styledSeparator);
export const StyledSelectSeparator = classed(Select.Separator)(styledSeparator);

export const styledInlineA =
  "text-purple-700 underline hover:text-black dark:text-purple-500 dark:hover:text-purple-300";

export const menuItemLike = ({
  variant = "default",
}: {
  variant?: B3Variant;
}) =>
  clsx([
    {
      "text-black dark:text-gray-300": variant === "default",
      "text-red-500 dark:text-red-300": variant === "destructive",
    },
    `cursor-pointer
    hover:bg-gray-200 dark:hover:bg-gray-700
    focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700
    flex items-center
    w-full
    py-1 pl-3 pr-3
    text-sm gap-x-2`,
  ]);

export const StyledButtonItem = classed.div(menuItemLike);
export const StyledRadioItem = classed(DD.RadioItem)(menuItemLike);
export const StyledItem = classed(DD.Item)(menuItemLike);
export const StyledSelectItem = classed(Select.Item)(menuItemLike);
export const StyledMenuLink = React.forwardRef(
  (
    {
      children,
      variant = "default",
      ...attributes
    }: {
      children: React.ReactNode;
      variant?: B3Variant;
    } & React.HTMLAttributes<HTMLAnchorElement>,
    ref: React.ForwardedRef<HTMLAnchorElement>,
  ) => {
    return (
      <a
        className={menuItemLike({ variant })}
        ref={ref}
        {...attributes}
        onClick={(e) => {
          attributes.onClick?.(e);
          try {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape" }),
            );
          } catch (e) {
            captureError(e as Error);
          }
        }}
      >
        {children}
      </a>
    );
  },
);
export const DDSubTriggerItem = classed(DD.SubTrigger)(menuItemLike);
export const CMSubTriggerItem = classed(CM.SubTrigger)(
  menuItemLike({ variant: "default" }) + " justify-between",
);
export const CMItem = classed(CM.Item)(menuItemLike);

export const StyledPopoverCross = () => (
  <Popover.Close
    className="flex
  focus-visible:text-black dark:focus-visible:text-white
  text-gray-500 dark:text-gray-300
  hover:text-black dark:hover:text-white"
  >
    <Cross1Icon className="w-3 h-3" />
  </Popover.Close>
);

export const PopoverTitleAndClose = ({ title }: { title: string }) => (
  <div className="flex items-start justify-between pb-2">
    <StyledLabelSpan>{title}</StyledLabelSpan>
  </div>
);

export type B3Size = "xxs" | "xs" | "sm" | "md" | "lg";
export type B3Variant =
  | "default"
  | "primary"
  | "quiet"
  | "code"
  | "quiet/mode"
  | "destructive";
export type B3Side = "default" | "left" | "right" | "middle";

export const sharedPadding = (
  size: B3Size,
  side: B3Side = "default",
): ClassValue => ({
  "p-0 text-xs rounded-sm": size === "xxs",
  "py-0.5 px-1.5 text-xs rounded-sm": size === "xs",
  "py-1 px-2 text-sm rounded": size === "sm",
  "py-1 px-3 text-md rounded": size === "md",
  "rounded-l-none": side === "right",
  "rounded-r-none": side === "left",
  "rounded-none": side === "middle",
});

export const sharedEqualPadding = (size: B3Size): ClassValue => ({
  "p-1.5 text-xs rounded-sm": size === "xs",
  "p-2 text-sm rounded": size === "sm",
  "p-3 text-md rounded": size === "md",
});

export const styledRadio = clsx(
  "text-purple-500 dark:bg-transparent dark:checked:bg-purple-500 focus:ring-purple-500",
  sharedOutline("primary"),
);

/**
 * Shared by select and buttons
 */
export function sharedOutline(
  variant: B3Variant,
  disabled = false,
): ClassValue {
  return [
    `
    outline-none

  `,
    disabled
      ? ""
      : `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-purple-500
    dark:focus-visible:ring-purple-500
    dark:focus-visible:ring-offset-gray-900`,

    {
      [`border border-purple-500`]: variant === "primary",
      [`border
    border-gray-200               dark:border-gray-500
    shadow-sm
  `]: variant === "default",

      [`
    focus-visible:border-gray-200   dark:focus-visible:border-gray-300
    hover:border-gray-300   dark:hover:border-gray-300
    `]: variant === "default" && !disabled,

      [`border
    border-red-200               dark:border-red-300
  `]: variant === "destructive",

      [`
    focus-visible:border-red-500   dark:focus-visible:border-red-300
    hover:border-red-300   dark:hover:border-red-300
  `]: variant === "destructive" && !disabled,
    },
  ];
}

const sharedBackground = (variant: B3Variant, disabled = false): ClassValue => {
  switch (variant) {
    case "primary":
    case "code":
      return [
        `bg-purple-500`,
        !disabled &&
          `hover:bg-purple-600 dark:hover:bg-purple-400 hover:shadow`,
      ];
    case "default":
      return !disabled && `hover:bg-gray-100 dark:hover:bg-gray-800`;
    case "quiet":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "quiet/mode":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "destructive":
      return !disabled && `hover:bg-red-500/10 dark:hover:bg-red-500/20`;
  }
};

const sharedText = (variant: B3Variant): ClassValue => {
  switch (variant) {
    case "quiet":
    case "code":
    case "quiet/mode":
    case "default": {
      return "font-medium text-gray-700 dark:text-white";
    }
    case "primary": {
      return "font-medium text-white";
    }
    case "destructive": {
      return "font-medium text-red-500 dark:text-red-300";
    }
  }
};

export const styledButton = ({
  size = "sm",
  variant = "default",
  disabled = false,
  side = "default",
}: {
  size?: B3Size | "full-width";
  variant?: B3Variant;
  disabled?: boolean;
  side?: B3Side;
}) =>
  clsx(
    variant === "quiet/mode"
      ? `aria-expanded:bg-purple-400 aria-expanded:text-white
      dark:aria-expanded:bg-purple-600
    data-state-on:bg-purple-400 dark:data-state-on:bg-gray-900`
      : variant === "primary"
        ? `aria-expanded:bg-purple-600
    data-state-on:bg-purple-600`
        : `
    aria-expanded:bg-gray-200 dark:aria-expanded:bg-black
    data-state-on:bg-gray-200 dark:data-state-on:bg-gray-600`,
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "transition-colors",
    // Focus
    `focus-visible:outline-none`,
    // Sizing
    sharedPadding(size === "full-width" ? "md" : size, side),
    // Display
    `inline-flex items-center gap-x-1`,
    // Transition
    // `transition-all`,
    // Text
    sharedText(variant),
    // Outline
    sharedOutline(variant, disabled),
    sharedBackground(variant, disabled),
    size === "full-width" && "flex-auto justify-center",
    // Colored variants
    {},
  );

export const styledPanelTitle = ({
  interactive = false,
}: {
  interactive?: boolean;
}) =>
  clsx(
    `text-sm
  w-full
  text-gray-700 dark:text-gray-300
  flex justify-between items-center`,
    "px-3 py-3",
    interactive && `hover:text-gray-900 dark:hover:text-white`,
  );

export const Button = classed.button(styledButton);

// TODO: all kinds of issues with select. Change to styled soon.
export const styledSelect = ({
  size,
  variant = "default",
}: {
  size: B3Size;
  variant?: B3Variant;
}) =>
  clsx([
    sharedPadding(size),
    sharedOutline(variant),
    sharedText("default"),
    `
    pr-8
    bg-transparent

    focus-visible:bg-white
    active:bg-white

    dark:focus-visible:bg-black
    dark:active:bg-black
    `,
  ]);

export const inputClass = ({
  _size = "sm",
  variant = "default",
}: {
  _size?: B3Size;
  variant?: B3Variant;
}) =>
  clsx([
    sharedPadding(_size),
    sharedOutline("default"),
    {
      "font-mono": variant === "code",
    },
    `block w-full
    dark:bg-transparent dark:text-gray-100`,
  ]);

export const Keycap = classed.div(({ size = "sm" }: { size?: B3Size }) => [
  {
    "text-sm px-2": size === "sm",
    "text-xs px-1": size === "xs",
  },
  `text-center
  dark:bg-gray-700/50
  font-mono rounded
  ring-1 ring-gray-100 dark:ring-black
  border border-b-4 border-r-2
  border-gray-300 dark:border-gray-500`,
]);

export const Input = classed.input(inputClass);
export const StyledField = classed(Field)(inputClass);

export const TextWell = classed.div(
  ({
    size = "sm",
    variant = "default",
  }: {
    size?: B3Size;
    variant?: B3Variant;
  }) =>
    clsx({
      "text-sm": size === "sm",
      "py-2 px-3":
        (variant === "destructive" || variant === "primary") && size === "sm",
      "py-1 px-2":
        (variant === "destructive" || variant === "primary") && size === "xs",
      "text-xs": size === "xs",
      "text-gray-700 dark:text-gray-300": variant === "default",
      "text-red-700 dark:text-red-100 bg-red-50 dark:bg-red-900 rounded":
        variant === "destructive",
      "bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded":
        variant === "primary",
    }),
);

export const StyledSwitch = classed(S.Root)(
  `w-10 h-5 relative rounded-full
  bg-gray-200 dark:bg-black
  data-state-checked:bg-gray-600 dark:data-state-checked:bg-gray-600
  dark:ring-1 dark:ring-gray-400
  transition-all`,
);
export const StyledThumb = classed(S.Thumb)(
  `w-5 h-5 border-2
  border-gray-200 dark:border-black
  data-state-checked:border-gray-600 dark:data-state-checked:border-gray-600
  rounded-full bg-white transition-all block shadow-sm data-state-checked:translate-x-5`,
);

export const StyledPopoverTrigger = classed(Popover.Trigger)(
  clsx(
    `aria-expanded:bg-gray-200 dark:aria-expanded:bg-gray-900
    data-state-on:bg-gray-200 dark:data-state-on:bg-gray-600`,
    "disabled:opacity-50 disabled:cursor-not-allowed",
    // Focus
    `focus-visible:outline-none`,
    // Sizing
    `py-1 px-1 rounded text-sm`,
    // Display
    `relative w-full flex items-center gap-x-1`,
    // Transition
    // `transition-all`,
    // Text
    sharedText("default"),
    // Outline
    sharedOutline("default", false),
    sharedBackground("default", false),
    // Colored variants
    {},
  ),
);

export const H1 = classed.h2("font-bold text-2xl");
export const H2 = classed.h2("font-bold text-xl");

export const MinimalHeaderLogoLink = () => {
  return (
    <Link
      href="/"
      className="py-1 pl-1 pr-2
                      flex
                      gap-x-1
                      items-center
                      dark:hover:bg-gray-700
                      focus-visible:ring-1 focus-visible:ring-purple-300
                      text-purple-500 hover:text-purple-700 dark:hover:text-purple-300"
      title="Home"
    >
      <SiteIcon className="w-8 h-8" />
      <Placemark className="hidden sm:block w-24 text-gray-700 dark:text-gray-300" />
    </Link>
  );
};

export const MinimalHeader = () => {
  return (
    <div className="flex border-b dark:border-black border-gray-200">
      <nav className="w-full max-w-4xl mx-auto flex items-center flex-auto gap-x-2 py-2">
        <MinimalHeaderLogoLink />
      </nav>
    </div>
  );
};

export function Table({ children }: React.PropsWithChildren<unknown>) {
  return (
    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
        <div className="overflow-hidden ring-1 ring-gray-300 dark:ring-gray-500 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
            {children}
          </table>
        </div>
      </div>
    </div>
  );
}

export function TableHead({ children }: React.PropsWithChildren<unknown>) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200">
      <tr>{children}</tr>
    </thead>
  );
}

export const Th = classed.td(({ first = false }: { first?: boolean }) =>
  clsx(
    "py-2 pr-3 text-left text-sm font-semibold",
    first ? "pl-4 sm:pl-6" : "px-3",
  ),
);

export const Td = classed.td(({ first = false }: { first?: boolean }) => {
  return clsx(
    "whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium",
    first && "sm:pl-6",
  );
});

export const Tbody = classed.tbody(
  "divide-y divide-gray-200 dark:divide-gray-500 bg-white dark:bg-gray-800",
);

export const VisibilityToggleIcon = ({
  visibility,
}: {
  visibility: boolean;
}) => {
  return visibility ? <EyeOpenIcon /> : <EyeNoneIcon />;
};
export const LabelToggleIcon = ({ visibility }: { visibility: boolean }) => {
  return visibility ? <TextIcon /> : <TextNoneIcon />;
};

export const PoiToggleIcon = ({ visibility }: { visibility: boolean }) => {
  return visibility ? <DrawingPinFilledIcon /> : <DrawingPinIcon />;
};
