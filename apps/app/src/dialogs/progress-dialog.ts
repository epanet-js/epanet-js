import type { DialogState } from "src/state/dialog";

const SHOW_AFTER_MS = 300;
const MIN_VISIBLE_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ProgressDialogResult<TResult> = {
  result: TResult;
  wasShown: boolean;
};

export const withProgressDialog = async <TPhase, TResult>(
  setDialog: (state: DialogState) => void,
  initialPhase: TPhase,
  build: (phase: TPhase) => DialogState,
  run: (setPhase: (phase: TPhase) => void) => Promise<TResult>,
): Promise<ProgressDialogResult<TResult>> => {
  let phase = initialPhase;
  let shownAt: number | null = null;

  const timer = setTimeout(() => {
    shownAt = Date.now();
    setDialog(build(phase));
  }, SHOW_AFTER_MS);

  const setPhase = (next: TPhase) => {
    phase = next;
    if (shownAt !== null) setDialog(build(next));
  };

  try {
    const result = await run(setPhase);
    await settle(timer, shownAt);
    return { result, wasShown: shownAt !== null };
  } catch (error) {
    await settle(timer, shownAt);
    throw error;
  }
};

const settle = async (
  timer: ReturnType<typeof setTimeout>,
  shownAt: number | null,
): Promise<void> => {
  clearTimeout(timer);
  if (shownAt === null) return;
  const visibleFor = Date.now() - shownAt;
  if (visibleFor < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - visibleFor);
};
