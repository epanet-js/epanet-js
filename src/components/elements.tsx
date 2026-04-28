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
import { SUPPORT_EMAIL } from "src/lib/constants";
import { Portal } from "@radix-ui/react-portal";
import { useTranslate } from "src/hooks/use-translate";
import {
  CloseIcon,
  HelpIcon,
  RefreshIcon,
  LabelsIcon,
  VisibilityOffIcon,
  VisibilityOnIcon,
  TypeOffIcon,
} from "src/icons";

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger className="dark:text-white align-middle">
        <HelpIcon />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <TContent>
          <div className="w-36">{children}</div>
        </TContent>
      </Tooltip.Portal>
    </Tooltip.Root>
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
      <div className="px-3 py-2 text-white bg-gray-500 rounded-md max-w-md">
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
  text,
}: {
  size?: B3Size;
  text?: string;
}) {
  const translate = useTranslate();
  const loadingText = text || translate("loading");
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
      <RefreshIcon className="animate-spin" />
      <span className="ml-2">{loadingText}</span>
    </div>
  );
}

export const LogoIcon: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      viewBox="0 0 19 26"
      style={{
        fillRule: "evenodd",
        clipRule: "evenodd",
        strokeLinejoin: "round",
        strokeMiterlimit: 2,
      }}
      width={size}
    >
      <path d="M0 0h19v26H0z" style={{ fill: "none" }} />
      <clipPath id="logo-icon-clip">
        <path d="M0 0h19v26H0z" />
      </clipPath>
      <g clipPath="url(#logo-icon-clip)">
        <path
          d="M15.133 7.592.632 13.813c-.378 1.103-.367 2.139-.367 3.092 0 1.754.734 3.444 1.685 4.918l16.437-7.187c-.602-2.224-1.796-4.783-3.255-7.044h.001Z"
          style={{ fill: "#ccd3d8", fillRule: "nonzero" }}
        />
        <path
          d="m1.95 21.823.012.018c.057.088.116.175.175.261.06.085.122.169.185.252a6.574 6.574 0 0 0 .391.49 9.269 9.269 0 0 0 1.618 1.47 9.132 9.132 0 0 0 1.066.653c.093.048.187.094.282.139a7.21 7.21 0 0 0 .573.253 9.357 9.357 0 0 0 2.114.555 10.228 10.228 0 0 0 .623.065c.104.007.208.012.312.015a8.274 8.274 0 0 0 .549.003c.105-.002.21-.006.315-.012.104-.007.208-.016.312-.027.104-.009.208-.02.311-.032a11.136 11.136 0 0 0 .923-.169 7.464 7.464 0 0 0 .603-.167c.1-.031.199-.063.297-.098a7.345 7.345 0 0 0 .585-.225 9.15 9.15 0 0 0 .843-.413 8.955 8.955 0 0 0 .537-.321 8.407 8.407 0 0 0 .514-.359c.083-.063.165-.127.246-.193a7.71 7.71 0 0 0 .701-.626 9.155 9.155 0 0 0 2.265-3.702 9.475 9.475 0 0 0 .169-.603 7.93 7.93 0 0 0 .178-.92c.014-.104.026-.208.036-.312a7.979 7.979 0 0 0 .044-.623c.004-.105.006-.21.006-.315 0-.634-.169-1.535-.347-2.244L1.95 21.823Z"
          style={{ fill: "#aab6c1", fillRule: "nonzero" }}
        />
        <path
          d="M15.133 7.592c-.374-.597-.825-1.14-1.21-1.702C11.643 2.565 9.363 0 9.363 0s-2.28 2.565-4.56 5.89c-1.14 1.662-2.28 3.515-3.135 5.332-.437.929-.786 1.711-1.036 2.591l14.501-6.221Z"
          style={{ fill: "#eaedf0", fillRule: "nonzero" }}
        />
      </g>
    </svg>
  );
};

export const LogoWordmarkIcon: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      viewBox="0 0 69 16"
      fill="#6F7685"
      fill-rule="nonzero"
      width={size}
    >
      <path d="M1.482 8.636q.014.665.293 1.218t.831.878q.553.326 1.369.326.69 0 1.172-.204t.788-.486a2.4 2.4 0 0 0 .443-.516l.772.951q-.302.435-.731.761a3.1 3.1 0 0 1-1.043.501q-.614.176-1.495.176-1.199 0-2.069-.51a3.45 3.45 0 0 1-1.341-1.418Q0 9.406 0 8.227q0-1.084.443-1.956a3.35 3.35 0 0 1 1.29-1.376q.846-.506 2.035-.506 1.096 0 1.904.455.808.456 1.254 1.289.446.835.446 1.984 0 .075-.006.261t-.019.258zm4.393-1.188a2.1 2.1 0 0 0-.213-.809 1.9 1.9 0 0 0-.655-.759q-.452-.32-1.219-.319-.795 0-1.278.309a1.96 1.96 0 0 0-.709.745q-.225.438-.267.833zm4.822 8.335H9.134V4.605h1.59v1.392q.078-.283.452-.661t.998-.663q.625-.285 1.438-.284 1.034 0 1.832.491.798.49 1.256 1.373.458.882.458 2.066t-.47 2.067a3.45 3.45 0 0 1-1.28 1.369q-.81.486-1.844.486-.846 0-1.473-.316-.626-.317-.981-.713-.356-.396-.413-.631zm4.91-7.464q0-.801-.332-1.391a2.4 2.4 0 0 0-.872-.914 2.25 2.25 0 0 0-1.179-.324q-.693 0-1.262.33-.57.329-.904.92-.334.59-.334 1.379t.334 1.38.904.915q.569.326 1.262.326.639 0 1.179-.319.541-.32.872-.91.332-.591.332-1.392m9.147 3.705v-1.443q-.066.223-.414.622-.348.4-.949.719-.601.32-1.42.319a3.64 3.64 0 0 1-1.863-.486q-.836-.487-1.327-1.369-.49-.883-.491-2.067 0-1.184.491-2.066a3.57 3.57 0 0 1 1.327-1.373 3.6 3.6 0 0 1 1.863-.491q.807 0 1.401.29.593.291.947.669t.423.649V4.605h1.554v7.419zm-4.916-3.705q0 .801.353 1.392.352.59.918.91.567.319 1.205.319.693 0 1.235-.326.543-.325.856-.915t.313-1.38-.313-1.379a2.3 2.3 0 0 0-.856-.92 2.33 2.33 0 0 0-1.235-.33q-.638 0-1.205.324-.566.323-.918.914-.353.59-.353 1.391m12.714-3.93q.726 0 1.417.305.692.306 1.139.97.447.665.447 1.731v4.629h-1.584V7.705q0-1.103-.517-1.604-.516-.502-1.327-.502-.539 0-1.031.305-.492.304-.806.831a2.3 2.3 0 0 0-.313 1.193v4.096h-1.572V4.605h1.572v1.323q.075-.313.437-.672.361-.358.921-.613t1.217-.254m6.051 4.247q.014.665.293 1.218t.831.878 1.368.326q.69 0 1.173-.204.482-.204.788-.486a2.4 2.4 0 0 0 .443-.516l.772.951q-.301.435-.732.761a3.1 3.1 0 0 1-1.043.501q-.614.176-1.494.176-1.199 0-2.069-.51a3.45 3.45 0 0 1-1.341-1.418q-.471-.907-.471-2.086 0-1.084.443-1.956a3.35 3.35 0 0 1 1.29-1.376q.846-.506 2.035-.506 1.095 0 1.904.455.808.456 1.254 1.289.446.835.446 1.984 0 .075-.006.261t-.019.258zm4.393-1.188a2.1 2.1 0 0 0-.213-.809 1.9 1.9 0 0 0-.655-.759q-.453-.32-1.219-.319-.795 0-1.278.309a1.96 1.96 0 0 0-.709.745q-.227.438-.267.833zm2.602-2.843h1.455V1.56h1.557v3.045h1.91v1.35h-1.91v3.663q0 .656.23.96.23.305.619.305.343 0 .535-.127.19-.126.227-.169l.621 1.154a1.7 1.7 0 0 1-.288.175 3 3 0 0 1-.605.224 3.3 3.3 0 0 1-.863.101q-.868 0-1.45-.53-.583-.53-.583-1.675V5.955h-1.455zm6.653 2.621h4.654V8.59h-4.654zM58.842 16q-.609 0-1.017-.134t-.595-.267l.585-1.198q.12.099.28.165.16.067.461.067.4 0 .614-.243.215-.243.294-.682.08-.44.08-1.033v-8.07h1.572v8.452q0 .877-.22 1.541t-.718 1.033q-.5.369-1.336.369m1.533-13.934a1 1 0 0 1-.732-.302 1 1 0 0 1-.301-.725q0-.283.14-.518t.375-.378A1 1 0 0 1 60.375 0q.29 0 .522.142.234.141.372.376.14.235.139.521 0 .422-.3.725a1 1 0 0 1-.733.302m5.876 2.323q.582 0 1.085.117.502.117.867.279.365.16.518.287l-.62.997q-.187-.162-.654-.364a2.6 2.6 0 0 0-1.051-.202q-.633 0-1.075.246-.444.245-.443.721 0 .464.458.739.458.276 1.229.46.61.144 1.149.387.537.242.872.673t.334 1.147q0 .651-.273 1.104a2.1 2.1 0 0 1-.731.729 3.5 3.5 0 0 1-1.029.404q-.57.128-1.16.128-.686 0-1.236-.142a4.4 4.4 0 0 1-.923-.334 3 3 0 0 1-.551-.34l.629-1.118q.235.23.773.482a2.8 2.8 0 0 0 1.218.253q.76 0 1.232-.321.473-.32.473-.838 0-.389-.226-.624a1.6 1.6 0 0 0-.606-.379 6 6 0 0 0-.834-.251 7 7 0 0 1-.845-.267 3.1 3.1 0 0 1-.75-.419 1.9 1.9 0 0 1-.534-.63 1.85 1.85 0 0 1-.199-.882q0-.642.403-1.097.404-.454 1.067-.7a4.1 4.1 0 0 1 1.433-.245" />
    </svg>
  );
};

export const LogoIconAndWordmarkIcon: React.FC<{ size: number }> = ({
  size,
}) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 98 26" width={size}>
      <path
        fill="#ccd3d8"
        d="M14.869 7.592.367 13.813C-.011 14.916 0 15.952 0 16.905c.001 1.754.735 3.444 1.686 4.918l16.437-7.187c-.602-2.224-1.797-4.783-3.255-7.044z"
      />
      <path
        fill="#aab6c1"
        d="m1.686 21.823.012.018a9 9 0 0 0 .959 1.235 12 12 0 0 0 .442.445q.114.108.232.211a9 9 0 0 0 .994.76q.13.085.264.166a7 7 0 0 0 .544.309q.14.072.282.139a7 7 0 0 0 .573.253 10 10 0 0 0 .587.211 11 11 0 0 0 .603.169 10 10 0 0 0 1.547.24q.155.01.311.015a8 8 0 0 0 .55.003q.157-.003.314-.012.156-.01.312-.027.156-.014.312-.032.155-.021.308-.048a10 10 0 0 0 .615-.121 8 8 0 0 0 .899-.265 7 7 0 0 0 .585-.225 9 9 0 0 0 .843-.413q.136-.075.271-.154a9.2 9.2 0 0 0 2.553-2.283 10 10 0 0 0 .362-.511q.087-.13.169-.264a9 9 0 0 0 .306-.546q.073-.139.142-.279.068-.142.131-.285a12 12 0 0 0 .229-.582 9 9 0 0 0 .19-.597 10 10 0 0 0 .151-.608q.03-.153.056-.306.029-.155.051-.309a11 11 0 0 0 .086-1.25c0-.634-.169-1.535-.347-2.244z"
      />
      <path
        fill="#eaedf0"
        d="M14.869 7.592c-.375-.597-.825-1.14-1.211-1.702C11.378 2.565 9.098 0 9.098 0S6.819 2.565 4.539 5.89c-1.14 1.662-2.28 3.515-3.135 5.332-.438.929-.787 1.711-1.037 2.591z"
      />
      <path
        fill="#6F7685"
        d="M28.477 14.602q.012.662.291 1.212.277.55.828.875t1.363.325q.687 0 1.167-.203t.785-.485q.305-.28.442-.514l.768.948q-.3.433-.728.758a3.1 3.1 0 0 1-1.039.499q-.61.175-1.488.175-1.194 0-2.061-.508a3.44 3.44 0 0 1-1.336-1.412q-.47-.903-.469-2.078 0-1.08.442-1.948a3.33 3.33 0 0 1 1.284-1.371q.843-.504 2.027-.504 1.092 0 1.897.454.805.453 1.248 1.284.444.83.444 1.975 0 .075-.006.26-.005.186-.018.258zm4.375-1.184a2.1 2.1 0 0 0-.213-.805 1.9 1.9 0 0 0-.652-.757q-.45-.317-1.214-.317-.792 0-1.273.307a1.95 1.95 0 0 0-.706.743 2.3 2.3 0 0 0-.266.829zm4.802 8.302h-1.557V10.587h1.584v1.386q.078-.282.45-.658t.995-.66 1.432-.284q1.029 0 1.824.489t1.251 1.368.456 2.058-.468 2.058a3.44 3.44 0 0 1-1.275 1.364q-.807.484-1.836.484-.843 0-1.467-.315t-.978-.709q-.354-.395-.411-.629zm4.89-7.434q0-.798-.33-1.386a2.4 2.4 0 0 0-.868-.911 2.26 2.26 0 0 0-1.175-.322q-.69 0-1.257.329a2.4 2.4 0 0 0-.9.916q-.333.588-.333 1.374t.333 1.374.9.912 1.257.324a2.27 2.27 0 0 0 1.175-.318q.538-.318.868-.906t.33-1.386m9.111 3.69v-1.437q-.066.222-.412.62-.346.397-.945.715t-1.415.318q-1.023 0-1.855-.484a3.53 3.53 0 0 1-1.322-1.364q-.489-.879-.489-2.058t.489-2.058a3.56 3.56 0 0 1 1.322-1.368 3.6 3.6 0 0 1 1.855-.489q.804 0 1.395.29t.944.666q.352.376.421.646v-1.386h1.548v7.389zm-4.896-3.69q0 .798.351 1.386t.915.906 1.2.318q.69 0 1.23-.324t.852-.912.312-1.374-.312-1.374a2.3 2.3 0 0 0-.852-.916 2.3 2.3 0 0 0-1.23-.329 2.4 2.4 0 0 0-1.2.322 2.5 2.5 0 0 0-.915.911q-.351.588-.351 1.386m12.663-3.915q.723 0 1.412.305.689.304 1.134.966t.445 1.723v4.611h-1.578v-4.302q0-1.098-.514-1.597-.515-.5-1.322-.5-.537 0-1.027.303a2.4 2.4 0 0 0-.803.828 2.3 2.3 0 0 0-.312 1.188v4.08h-1.566v-7.389h1.566v1.317q.075-.312.435-.669a3.1 3.1 0 0 1 .918-.61 2.9 2.9 0 0 1 1.212-.254m6.027 4.231q.013.662.291 1.212t.828.875 1.363.325q.687 0 1.168-.203t.785-.485q.305-.28.441-.514l.769.948a3.3 3.3 0 0 1-.729.758 3.1 3.1 0 0 1-1.038.499q-.612.175-1.489.175-1.194 0-2.061-.508a3.44 3.44 0 0 1-1.336-1.412q-.468-.903-.469-2.078 0-1.08.442-1.948a3.33 3.33 0 0 1 1.284-1.371q.843-.504 2.027-.504 1.092 0 1.897.454.805.453 1.249 1.284.444.83.444 1.975 0 .075-.006.26-.006.186-.019.258zm4.375-1.184a2.1 2.1 0 0 0-.212-.805 1.9 1.9 0 0 0-.652-.757q-.451-.317-1.215-.317-.791 0-1.272.307a1.95 1.95 0 0 0-.707.743q-.225.435-.265.829zm2.592-2.831h1.449V7.554h1.551v3.033h1.902v1.344h-1.902v3.648q0 .654.229.957a.74.74 0 0 0 .617.303q.342 0 .532-.126t.227-.168l.618 1.149a1.7 1.7 0 0 1-.287.174 3 3 0 0 1-.603.224q-.37.1-.859.1-.864 0-1.445-.528-.58-.528-.58-1.668v-4.065h-1.449zm6.627 2.61h4.635v1.359h-4.635zm6.564 8.739q-.606 0-1.013-.133-.406-.134-.592-.266l.582-1.194q.12.099.279.165t.459.066q.399 0 .612-.241.213-.242.292-.68.08-.438.08-1.029v-8.037h1.566v8.418q0 .873-.219 1.534-.22.662-.716 1.03-.496.367-1.33.367m1.527-13.878a1 1 0 0 1-.729-.301 1 1 0 0 1-.3-.722q0-.282.139-.516.14-.234.374-.376A.97.97 0 0 1 87.134 6q.288 0 .52.141t.371.375.138.519q0 .42-.299.722a1 1 0 0 1-.73.301m5.853 2.313q.579 0 1.08.117t.864.278.516.286l-.618.993q-.186-.162-.651-.363a2.6 2.6 0 0 0-1.047-.201q-.63 0-1.071.245-.441.244-.441.718 0 .462.456.737t1.224.457q.609.144 1.144.386.536.241.869.67t.333 1.143q0 .648-.272 1.1a2.1 2.1 0 0 1-.729.726 3.4 3.4 0 0 1-1.024.402 5.3 5.3 0 0 1-1.155.127 5 5 0 0 1-1.232-.141 4.4 4.4 0 0 1-.919-.333 3.2 3.2 0 0 1-.549-.339l.627-1.113q.234.228.769.48.536.252 1.214.252.756 0 1.227-.319.471-.32.471-.836 0-.387-.225-.621a1.6 1.6 0 0 0-.603-.378 6 6 0 0 0-.831-.249 7 7 0 0 1-.842-.267 3 3 0 0 1-.747-.417q-.334-.255-.532-.627a1.85 1.85 0 0 1-.198-.879q0-.639.402-1.092t1.062-.697a4.1 4.1 0 0 1 1.428-.245"
      />
    </svg>
  );
};

export const CapsLabel = classed.label(
  "block uppercase font-semibold text-gray-500 dark:text-gray-500 text-xs",
);

const overlayClasses =
  "fixed inset-0 bg-black/20 dark:bg-white/20 z-40 placemark-fadein";

export const StyledAlertDialogOverlay = classed(AlertDialog.Overlay)(
  overlayClasses,
);
export const StyledDialogOverlay = classed(Dialog.Overlay)(overlayClasses);

type DialogSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "xxl"
  | "fullscreen"
  | "auto";

export const styledDialogContent = ({
  size = "md",
  height,
}: {
  size?: DialogSize;
  height?: "md" | "lg" | "xl" | "xxl";
}) => {
  if (size === "fullscreen") {
    return "fixed inset-0 z-[100] w-screen h-dvh flex flex-col text-left bg-white dark:bg-gray-900 shadow-md dark:text-white dark:shadow-none dark:border dark:border-black";
  }

  const widthClass =
    size === "auto"
      ? undefined
      : {
          xs: "max-w-[360px]",
          sm: "max-w-[480px]",
          md: "max-w-screen-sm",
          lg: "max-w-full md:max-w-screen-md",
          xl: "max-w-full lg:max-w-screen-lg",
          xxl: "max-w-full xl:max-w-screen-xl",
        }[size];

  const heightClass =
    height &&
    {
      md: "h-[300px]",
      lg: "h-[480px]",
      xl: "h-[640px]",
      xxl: "h-[848px]",
    }[height];

  return clsx(
    size === "auto" ? "w-fit" : "w-full",
    "flex flex-col rounded-lg",
    "text-left bg-white dark:bg-gray-900 shadow-md",
    "dark:text-white dark:shadow-none dark:border dark:border-black",
    widthClass,
    heightClass,
    "max-h-full",
  );
};

const customWelcomeDialogContent = () => {
  return clsx(
    `fixed inline-block
      max-h-[720px]
      h-full
      max-w-[1024px]
      w-full
      text-left
      align-bottom
      bg-white dark:bg-gray-900
      dark:text-white
      shadow-md dark:shadow-none dark:border dark:border-black
      sm:rounded sm:align-middle w-full
      left-2/4 top-2/4 -translate-x-1/2 -translate-y-1/2
      overflow-y-auto placemark-scrollbar
      p-0
      z-40
      `,
  );
};

// Wrapper to prevent widthClasses and fillMode from being passed to DOM
const FilteredDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & {
    widthClasses?: string;
    fillMode?: string;
  }
>(({ widthClasses: _widthClasses, fillMode: _fillMode, ...props }, ref) => (
  <Dialog.Content ref={ref} {...props} />
));
export const StyledDialogContent = classed(FilteredDialogContent)(
  styledDialogContent,
);
export const WelcomeDialogContent = classed(Dialog.Content)(
  customWelcomeDialogContent,
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
    style={{ outline: "2px solid red" }}
  >
    <CloseIcon />
  </Dialog.Close>
);

export const TContent = classed(Tooltip.Content)(
  ({ size = "sm" }: { size?: B3Size }) => [
    {
      "max-w-md": size === "sm",
      "w-64": size === "md",
    },
    `px-2 py-1 rounded
  z-20
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
    overflow-hidden text-wrap
    focus-visible:ring-inset w-full
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

export const StyledPopoverClose = () => (
  <Popover.Close asChild>
    <CloseIcon />
  </Popover.Close>
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
    size?: B3Size | "no-width" | "auto";
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
      z-20
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
    content-layout z-30`;

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
      "text-red-500 dark:text-red-300":
        variant === "destructive" || variant === "danger-quiet",
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
    <CloseIcon />
  </Popover.Close>
);

export const PopoverTitleAndClose = ({ title }: { title: string }) => (
  <div className="flex items-start justify-between pb-2">
    <StyledLabelSpan>{title}</StyledLabelSpan>
  </div>
);

export type B3Size = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
export type B3Variant =
  | "default"
  | "primary"
  | "blue"
  | "quiet"
  | "code"
  | "quiet/mode"
  | "quiet/list"
  | "destructive"
  | "danger"
  | "danger-quiet"
  | "ultra-quiet"
  | "success";
export type B3Side = "default" | "left" | "right" | "middle";

export const sharedPadding = (
  size: B3Size,
  side: B3Side = "default",
): ClassValue => ({
  "p-0 text-xs rounded": size === "xxs",
  "py-0.5 px-1.5 text-xs rounded": size === "xs",
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
      : variant === "danger"
        ? `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-red-500
    dark:focus-visible:ring-red-500
    dark:focus-visible:ring-offset-gray-900`
        : variant === "blue"
          ? `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-blue-500
    dark:focus-visible:ring-blue-500
    dark:focus-visible:ring-offset-gray-900`
          : `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-purple-500
    dark:focus-visible:ring-purple-500
    dark:focus-visible:ring-offset-gray-900`,

    {
      [`border border-purple-500`]: variant === "primary",
      [`border border-blue-500`]: variant === "blue",
      [`border
    border-gray-300               dark:border-gray-500
    shadow-sm
  `]: variant === "default",

      [`
    focus-visible:border-gray-200   dark:focus-visible:border-gray-300
    hover:border-gray-200   dark:hover:border-gray-300
    `]: variant === "default" && !disabled,

      [`border
    border-red-200               dark:border-red-300
  `]: variant === "destructive",

      [`
    focus-visible:border-red-500   dark:focus-visible:border-red-300
    hover:border-red-300   dark:hover:border-red-300
  `]: variant === "destructive" && !disabled,

      [`border border-green-500`]: variant === "success",
      [`border border-red-700`]: variant === "danger",
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
    case "blue":
      return [
        `bg-blue-600`,
        !disabled && `hover:bg-blue-700 dark:hover:bg-blue-500 hover:shadow`,
      ];
    case "default":
      return [
        `bg-white dark:bg-gray-900`,
        !disabled && `hover:bg-gray-100 dark:hover:bg-gray-800`,
      ];
    case "quiet":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "ultra-quiet":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "quiet/mode":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "quiet/list":
      return !disabled && `hover:bg-gray-200 dark:hover:bg-gray-700`;
    case "destructive":
    case "danger-quiet":
      return !disabled && `hover:bg-red-600/10 dark:hover:bg-red-400/20`;
    case "success":
      return [
        `bg-green-500`,
        !disabled && `hover:bg-green-600 dark:hover:bg-green-400 hover:shadow`,
      ];
    case "danger":
      return [
        `bg-red-700`,
        !disabled && `hover:bg-red-600 dark:hover:bg-red-400 hover:shadow`,
      ];
  }
};

const sharedText = (variant: B3Variant): ClassValue => {
  switch (variant) {
    case "quiet":
    case "code":
    case "quiet/mode":
    case "quiet/list":
    case "danger-quiet":
    case "default": {
      return "font-medium text-gray-700 dark:text-white";
    }
    case "ultra-quiet":
      return "text-gray-500 hover:text-gray-700";
    case "primary": {
      return "font-medium text-white";
    }
    case "blue": {
      return "font-medium text-white";
    }
    case "destructive": {
      return "font-medium text-red-500 dark:text-red-300";
    }
    case "success": {
      return "font-medium text-white";
    }
    case "danger": {
      return "font-medium text-white";
    }
  }
};

export const styledButton = ({
  size = "sm",
  variant = "default",
  disabled = false,
  side = "default",
  textAlign = "center",
}: {
  size?: B3Size | "full-width";
  variant?: B3Variant;
  disabled?: boolean;
  side?: B3Side;
  textAlign?: "start" | "center";
}) =>
  clsx(
    variant === "quiet/list"
      ? `
    aria-expanded:bg-gray-200
    dark:aria-expanded:bg-gray-700
    group-focus-within:aria-expanded:bg-purple-300/40
    transition-colors
    `
      : variant === "quiet/mode"
        ? `aria-expanded:bg-purple-400 aria-expanded:text-white
      dark:aria-expanded:bg-purple-600
    data-state-on:bg-purple-400 dark:data-state-on:bg-gray-900`
        : variant === "primary"
          ? `aria-expanded:bg-purple-600
    data-state-on:bg-purple-600`
          : variant === "blue"
            ? `aria-expanded:bg-blue-700
    data-state-on:bg-blue-700`
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
    size === "full-width" &&
      `flex-auto w-full ${textAlign === "start" ? "justify-start" : "justify-center"}`,
    // Colored variants
    variant === "danger-quiet" &&
      `[&>svg]:text-red-500 dark:[&>svg]:text-red-300 hover:[&>svg]:text-red-600 dark:hover:[&>svg]:text-red-400`,
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
  rounded
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
  `w-10 h-5 rounded-full
  bg-gray-200 dark:bg-black
  data-state-checked:bg-purple-300 dark:data-state-checked:bg-purple-400
  dark:ring-1 dark:ring-gray-300
  transition-all`,
);
export const StyledThumb = classed(S.Thumb)(
  `w-5 h-5 border-2
  border-gray-200 dark:border-black
  data-state-checked:border-purple-300 dark:data-state-checked:border-purple-400
  rounded-full bg-white block shadow-sm data-state-checked:translate-x-5`,
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
  return visibility ? <VisibilityOnIcon /> : <VisibilityOffIcon />;
};
export const LabelToggleIcon = ({ visibility }: { visibility: boolean }) => {
  return visibility ? <LabelsIcon /> : <TypeOffIcon />;
};
