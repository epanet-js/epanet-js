import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useLayoutEffect, useRef, useState } from "react";
import { Button, StyledPopoverContent } from "src/components/elements";
import { Callout, SelectorList } from "@epanet-js/ui-kit";
import { useTranslate } from "src/hooks/use-translate";
import type {
  ScriptAssistantFailure,
  ScriptAssistantScope,
} from "src/lib/script-assistant";
import type { ScriptGeneration } from "./use-script-generation";
import {
  AiIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ErrorIcon,
  PlayIcon,
  StopSimulationIcon,
  TipIcon,
  VisibilityOnIcon,
} from "src/icons";

type Scope = ScriptAssistantScope;

const MAX_GROWN_LINES = 5;

const scopes: { value: Scope; available: boolean }[] = [
  { value: "script", available: true },
  { value: "scriptAndOutput", available: false },
  { value: "anonymizedNetwork", available: false },
  { value: "fullNetwork", available: false },
];

export const ScriptAssistant = ({
  onBack,
  onSend,
  onWriteMyself,
  generation,
  failure,
  onStop,
}: {
  onBack: () => void;
  onSend: (prompt: string, scope: Scope) => void;
  onWriteMyself: () => void;
  generation: ScriptGeneration | null;
  failure: ScriptAssistantFailure | null;
  onStop: () => void;
}) => {
  const translate = useTranslate();
  const [prompt, setPrompt] = useState("");

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <Button variant="quiet" aria-label={translate("back")} onClick={onBack}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="min-w-0 truncate px-1 text-sm font-semibold">
          {translate("scripting.createScript")}
        </h1>
      </div>
      <div className="flex-auto min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center px-5 py-6">
          <AiIcon size="2xl" className="self-center text-subtle" />
          <h2 className="py-4 text-center text-size-base font-semibold text-subtle">
            {translate("scripting.assistant.describeScript")}
          </h2>
          <ul className="flex flex-col gap-2 mb-4 text-size-base text-subtle">
            <Hint icon={<TipIcon size="md" />}>
              {translate("scripting.assistant.exampleExportCsv")}
            </Hint>
          </ul>
          <AssistantComposer
            label={translate("scripting.assistant.describeScript")}
            placeholder={translate(
              "scripting.assistant.describeScriptPlaceholder",
            )}
            submitLabel={translate("scripting.assistant.create")}
            submitVariant="primary"
            rows={3}
            value={prompt}
            onChange={setPrompt}
            onSend={onSend}
            busy={
              generation && {
                prompt: generation.prompt,
                status: translate("scripting.assistant.writing"),
              }
            }
            onStop={onStop}
            failure={failure}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            onClick={onWriteMyself}
            aria-hidden={generation !== null}
            tabIndex={generation ? -1 : undefined}
            className={clsx("self-center mt-12", generation && "invisible")}
          >
            {translate("scripting.assistant.writeMyself")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const AssistantComposer = ({
  label,
  placeholder,
  submitLabel,
  submitVariant,
  rows,
  value,
  onChange,
  onSend,
  busy,
  onStop,
  autoFocus = false,
  height = null,
  boxRef,
  failure,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  submitVariant: "primary" | "default";
  rows: 2 | 3;
  value: string;
  onChange: (value: string) => void;
  onSend: (prompt: string, scope: Scope) => void;
  busy: { prompt: string; status: string } | null;
  onStop: () => void;
  autoFocus?: boolean;
  height?: number | null;
  boxRef?: React.Ref<HTMLDivElement>;
  failure: ScriptAssistantFailure | null;
}) => {
  const translate = useTranslate();
  const [scope, setScope] = useState<Scope>("script");
  const canSend = value.trim() !== "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(
    function growWithText() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (height !== null) {
        textarea.style.height = "";
        return;
      }
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
      textarea.style.height = "auto";
      const maxHeight = Number.isNaN(lineHeight)
        ? Infinity
        : lineHeight * MAX_GROWN_LINES;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    },
    [value, height],
  );

  const send = () => {
    if (canSend) onSend(value.trim(), scope);
  };

  if (busy) {
    return (
      <div role="status" aria-live="polite">
        <div
          ref={boxRef}
          style={height !== null ? { height } : undefined}
          className="flex flex-col rounded-sm border border-strong bg-base p-2"
        >
          <p
            className={clsx(
              "text-size-base text-subtle whitespace-pre-wrap break-words",
              height !== null
                ? "flex-1 min-h-0 overflow-hidden"
                : clsx("line-clamp-5", rows === 3 ? "min-h-15" : "min-h-10"),
            )}
          >
            {busy.prompt}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <AiIcon className="text-accent animate-pulse" />
          <span className="flex-1 text-size-small font-medium text-default">
            {busy.status}
          </span>
          <Button variant="default" size="xs" onClick={onStop} className="h-7">
            <StopSimulationIcon size="sm" />
            {translate("scripting.assistant.stop")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={boxRef}
        style={height !== null ? { height } : undefined}
        className="flex flex-col rounded-sm border border-strong bg-base p-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
      >
        <textarea
          ref={textareaRef}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
          rows={rows}
          autoFocus={autoFocus}
          className={clsx(
            "block w-full resize-none border-0 bg-transparent p-0 text-size-base text-default outline-none focus:ring-0 placeholder:text-subtle",
            height !== null && "flex-1 min-h-0",
          )}
        />
      </div>
      {failure && (
        <Callout
          variant="error"
          Icon={ErrorIcon}
          title={translate(`scripting.assistant.failures.${failure}.title`)}
          description={translate(
            `scripting.assistant.failures.${failure}.description`,
          )}
          className="mt-2 rounded-md"
        />
      )}
      <div className="flex items-center justify-between gap-2 mt-2">
        <ScopeSelector value={scope} onChange={setScope} />
        <Button
          variant={submitVariant}
          size="xs"
          disabled={!canSend}
          onClick={send}
          className="h-7"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

export const AssistantFooter = ({
  onRun,
  isRunDisabled,
}: {
  onRun: () => void;
  isRunDisabled: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex items-center gap-2 p-2 border-t">
      <Button
        variant="primary"
        size="full-width"
        onClick={onRun}
        disabled={isRunDisabled}
        className="h-8"
      >
        <PlayIcon />
        {translate("scripting.run")}
      </Button>
    </div>
  );
};

const Hint = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-2">
    <span className="shrink-0 mt-0.5">{icon}</span>
    <span>{children}</span>
  </li>
);

const ScopeSelector = ({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (scope: Scope) => void;
}) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const scopeLabel = (scope: Scope) =>
    translate(`scripting.assistant.scopes.${scope}.label`);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="quiet"
          size="xs"
          aria-label={translate(
            "scripting.assistant.whatTheAiCanSeeValue",
            scopeLabel(value),
          )}
          className="h-7 gap-1 whitespace-nowrap"
        >
          <VisibilityOnIcon size="sm" />
          {scopeLabel(value)}
          <ChevronDownIcon size="sm" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent
          size="sm"
          flush="yes"
          align="start"
          side="top"
          sideOffset={4}
          aria-label={translate("scripting.assistant.whatTheAiCanSee")}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex flex-col overflow-hidden text-size-base"
        >
          <SelectorList<Scope>
            options={scopes.map((scope) => ({
              value: scope.value,
              label: scopeLabel(scope.value),
              description: translate(
                `scripting.assistant.scopes.${scope.value}.description`,
              ),
              disabled: !scope.available,
            }))}
            selected={value}
            onCommit={(scope) => {
              if (scope !== null) onChange(scope);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
            descriptionPlacement="below"
          />
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
