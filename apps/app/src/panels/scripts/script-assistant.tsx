import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useState } from "react";
import { Button, StyledPopoverContent } from "src/components/elements";
import { Tooltip } from "@epanet-js/ui-kit";
import type { ScriptAssistantScope } from "src/lib/script-assistant";
import type { ScriptGeneration } from "./use-script-generation";
import {
  AiIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  FilterIcon,
  PlayIcon,
  StopSimulationIcon,
  TableIcon,
  TagIcon,
  VisibilityOnIcon,
} from "src/icons";

type Scope = ScriptAssistantScope;

const scopes: {
  value: Scope;
  label: string;
  description: string;
  available: boolean;
}[] = [
  {
    value: "script",
    label: "Script only",
    description: "Your message and this script.",
    available: true,
  },
  {
    value: "scriptAndOutput",
    label: "Script + console output",
    description: "Adds the output of the last run, errors included.",
    available: false,
  },
  {
    value: "anonymizedNetwork",
    label: "Script + anonymized network",
    description:
      "Adds every asset and its attributes, without labels, custom attributes or coordinates.",
    available: false,
  },
  {
    value: "network",
    label: "Script + whole network",
    description: "Adds every asset, its attributes and the last results.",
    available: false,
  },
];

export const ScriptAssistant = ({
  onBack,
  onSend,
  onWriteMyself,
  generation,
  onStop,
}: {
  onBack: () => void;
  onSend: (prompt: string, scope: Scope) => void;
  onWriteMyself: () => void;
  generation: ScriptGeneration | null;
  onStop: () => void;
}) => {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <Button variant="quiet" aria-label="Back" onClick={onBack}>
          <ChevronLeftIcon />
        </Button>
        <h1 className="min-w-0 truncate px-1 text-sm font-semibold">
          Create a script
        </h1>
      </div>
      <div className="flex-auto min-h-0 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center px-5 py-6">
          <AiIcon size="2xl" className="self-center text-subtle" />
          <h2 className="py-4 text-center text-size-base font-semibold text-subtle">
            Describe the script you want
          </h2>
          <ul className="flex flex-col gap-2 mb-4 text-size-base text-subtle">
            <Hint icon={<FilterIcon size="md" />}>
              Say what to find, like pipes at or below 100 mm or nodes under 20
              m of pressure.
            </Hint>
            <Hint icon={<TableIcon size="md" />}>
              Say what to hand back: a table, a CSV file or a selection on the
              map.
            </Hint>
            <Hint icon={<TagIcon size="md" />}>
              Use the names in your model: zones, custom attributes, patterns.
            </Hint>
          </ul>
          <AssistantComposer
            label="Describe the script you want"
            placeholder="Select every pipe at or below 100 mm and export them as CSV"
            rows={3}
            value={prompt}
            onChange={setPrompt}
            onSend={onSend}
            busy={
              generation && {
                prompt: generation.prompt,
                status: "Writing script…",
              }
            }
            onStop={onStop}
            autoFocus
          />
          <Button
            variant="default"
            size="sm"
            onClick={onWriteMyself}
            aria-hidden={generation !== null}
            tabIndex={generation ? -1 : undefined}
            className={clsx("self-center mt-4", generation && "invisible")}
          >
            Write script myself
          </Button>
        </div>
      </div>
    </div>
  );
};

export const AssistantComposer = ({
  label,
  placeholder,
  rows,
  value,
  onChange,
  onSend,
  busy,
  onStop,
  autoFocus = false,
}: {
  label: string;
  placeholder: string;
  rows: 2 | 3;
  value: string;
  onChange: (value: string) => void;
  onSend: (prompt: string, scope: Scope) => void;
  busy: { prompt: string; status: string } | null;
  onStop: () => void;
  autoFocus?: boolean;
}) => {
  const [scope, setScope] = useState<Scope>("script");
  const canSend = value.trim() !== "";

  const send = () => {
    if (canSend) onSend(value.trim(), scope);
  };

  if (busy) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-sm border border-strong bg-base p-2"
      >
        <p
          className={clsx(
            "text-size-base text-subtle whitespace-pre-wrap break-words",
            rows === 3 ? "h-15 line-clamp-3" : "h-10 line-clamp-2",
          )}
        >
          {busy.prompt}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <AiIcon className="text-accent animate-pulse" />
          <span className="flex-1 text-size-small font-medium text-default">
            {busy.status}
          </span>
          <Button variant="default" size="xs" onClick={onStop} className="h-7">
            <StopSimulationIcon size="sm" />
            Stop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-strong bg-base p-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      <textarea
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        rows={rows}
        autoFocus={autoFocus}
        className="block w-full resize-none border-0 bg-transparent p-0 text-size-base text-default outline-none focus:ring-0 placeholder:text-subtle"
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <ScopeSelector value={scope} onChange={setScope} />
        <Button
          variant="primary"
          aria-label="Send"
          title="Send"
          disabled={!canSend}
          onClick={send}
          className="h-7 w-7 justify-center"
        >
          <ArrowUpIcon />
        </Button>
      </div>
    </div>
  );
};

export const AssistantFooter = ({
  isComposerOpen,
  onToggleComposer,
  onRun,
  isRunDisabled,
}: {
  isComposerOpen: boolean;
  onToggleComposer: () => void;
  onRun: () => void;
  isRunDisabled: boolean;
}) => (
  <div className="flex items-center gap-2 p-2 border-t">
    <Tooltip delayDuration={700} content="Ask AI">
      <Button
        variant="quiet"
        aria-label="Ask AI"
        aria-pressed={isComposerOpen}
        onClick={onToggleComposer}
        className={clsx(
          "h-8 w-8 justify-center",
          isComposerOpen && "bg-base-hover text-accent",
        )}
      >
        <AiIcon />
      </Button>
    </Tooltip>
    <Button
      variant="primary"
      size="full-width"
      onClick={onRun}
      disabled={isRunDisabled}
      className="h-8"
    >
      <PlayIcon />
      Run
    </Button>
  </div>
);

const Hint = ({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-1">
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
  const [isOpen, setIsOpen] = useState(false);
  const current = scopes.find((scope) => scope.value === value) ?? scopes[0];

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="default"
          size="xs"
          aria-label={`What the AI can see: ${current.label}`}
          className="h-7 gap-1 whitespace-nowrap"
        >
          <VisibilityOnIcon size="sm" />
          {current.label}
          <ChevronDownIcon size="sm" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent
          size="sm"
          align="start"
          side="top"
          sideOffset={4}
          aria-labelledby="script-assistant-scope-title"
        >
          <h3
            id="script-assistant-scope-title"
            className="pb-2 text-size-base font-semibold text-default"
          >
            What the AI can see
          </h3>
          <div role="radiogroup" className="flex flex-col gap-0.5">
            {scopes.map((scope) => {
              const isChecked = scope.value === value;
              return (
                <label
                  key={scope.value}
                  className={clsx(
                    "flex items-start gap-x-2 -mx-1 px-1 py-2 rounded-sm",
                    isChecked && "bg-accent-tint",
                    scope.available
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-50",
                    scope.available && !isChecked && "hover:bg-base-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="script-assistant-scope"
                    value={scope.value}
                    checked={isChecked}
                    disabled={!scope.available}
                    onChange={() => {
                      onChange(scope.value);
                      setIsOpen(false);
                    }}
                    className="mt-0.5 shrink-0 text-accent-hover focus:ring-accent disabled:opacity-50"
                  />
                  <span className="flex flex-col gap-y-0.5">
                    <span className="text-size-base font-semibold text-default">
                      {scope.label}
                    </span>
                    <span className="text-size-small text-subtle">
                      {scope.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
