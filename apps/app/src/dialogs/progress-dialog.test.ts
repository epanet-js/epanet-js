import type { DialogState } from "src/state/dialog";
import { withProgressDialog } from "./progress-dialog";

const build = (phase: string): DialogState =>
  ({ type: "openProjectProgress", phase }) as DialogState;

const run = <T>(
  setDialog: (state: DialogState) => void,
  work: (setPhase: (phase: string) => void) => Promise<T>,
) => withProgressDialog(setDialog, "opening", build, work);

describe("withProgressDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows nothing when the work finishes quickly", async () => {
    const setDialog = vi.fn();

    const { wasShown } = await run(setDialog, () => Promise.resolve("done"));

    expect(setDialog).not.toHaveBeenCalled();
    expect(wasShown).toBe(false);
  });

  it("returns the work's result", async () => {
    const { result } = await run(vi.fn(), () => Promise.resolve("done"));

    expect(result).toBe("done");
  });

  it("shows the dialog once the work runs long", async () => {
    const setDialog = vi.fn();

    const pending = run(setDialog, () => vi.advanceTimersByTimeAsync(300));
    await vi.advanceTimersByTimeAsync(300);
    expect(setDialog).toHaveBeenCalledWith(build("opening"));

    await vi.advanceTimersByTimeAsync(400);
    expect((await pending).wasShown).toBe(true);
  });

  it("carries the latest phase into the dialog when it appears", async () => {
    const setDialog = vi.fn();

    const pending = run(setDialog, async (setPhase) => {
      setPhase("building");
      await vi.advanceTimersByTimeAsync(300);
    });
    await vi.advanceTimersByTimeAsync(700);
    await pending;

    expect(setDialog).toHaveBeenCalledWith(build("building"));
  });

  it("holds a shown dialog long enough to be read", async () => {
    let settled = false;
    const pending = run(vi.fn(), () => vi.advanceTimersByTimeAsync(300)).then(
      () => {
        settled = true;
      },
    );

    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    await pending;
    expect(settled).toBe(true);
  });

  it("never shows the dialog after the work has already failed", async () => {
    const setDialog = vi.fn();

    await expect(
      run(setDialog, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await vi.advanceTimersByTimeAsync(1000);

    expect(setDialog).not.toHaveBeenCalled();
  });
});
