import { describe, expect, it } from "vitest";
import { MomentLog } from "./moment-log";
import { fMoment } from "./moment";

describe("MomentLog", () => {
  it("registers to the history of moments", () => {
    const { forward, reverse } = anAction();
    const momentLog = new MomentLog();

    momentLog.append(forward, reverse);

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual(reverse);
    expect(momentLog.nextRedo()).toEqual(null);
  });

  it("can undo / redo ", () => {
    const { forward, reverse } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse);

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual(forward);

    momentLog.redo();

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual(reverse);
    expect(momentLog.nextRedo()).toEqual(null);
  });

  it("does nothing when cannot undo more", () => {
    const { forward, reverse } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse);

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual(forward);

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual(forward);
  });

  it("does nothing when cannot redo more", () => {
    const { forward, reverse } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse);

    momentLog.undo();

    momentLog.redo();
    momentLog.redo();

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual(reverse);
    expect(momentLog.nextRedo()).toEqual(null);
  });

  it("rewrites future when undo and doing changes", () => {
    const firstAction = anAction("FIRST");
    const momentLog = new MomentLog();
    momentLog.append(firstAction.forward, firstAction.reverse);

    const secondAction = anAction("SECOND");
    momentLog.append(secondAction.forward, secondAction.reverse);

    momentLog.undo();

    const thirdAction = anAction("THIRD");
    momentLog.append(thirdAction.forward, thirdAction.reverse);

    expect(momentLog.last()).toEqual(thirdAction.forward);

    momentLog.undo();
    expect(momentLog.last()).toEqual(firstAction.forward);

    momentLog.redo();
    expect(momentLog.last()).toEqual(thirdAction.forward);
  });

  const anAction = (name = "ANY_ACTION") => {
    return {
      forward: aMoment(name + "_forward"),
      reverse: aMoment(name + "_reverse"),
    };
  };

  const aMoment = (name: string) => {
    return fMoment(name);
  };
});
