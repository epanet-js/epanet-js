import { describe, expect, it } from "vitest";
import { MomentLog } from "./moment-log";
import { Moment, fMoment } from "./moment";

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

  it("search last active moment", () => {
    const momentLog = new MomentLog();
    const matchConditionFn = (moment: Moment) =>
      !!moment.note && moment.note.startsWith("MATCH_");

    const firstAction = anAction("MATCH_1");
    momentLog.append(firstAction.forward, firstAction.reverse);

    const secondAction = anAction("MATCH_2");
    momentLog.append(secondAction.forward, secondAction.reverse);

    const thirdAction = anAction("NO_MATCH");
    momentLog.append(thirdAction.forward, thirdAction.reverse);

    const fourthAction = anAction("MATCH_3");
    momentLog.append(fourthAction.forward, fourthAction.reverse);

    momentLog.undo();

    expect(momentLog.searchLast(matchConditionFn)).toEqual(1);

    momentLog.redo();

    expect(momentLog.searchLast(matchConditionFn)).toEqual(3);
  });

  it("can filter up to and including pointer", () => {
    const momentLog = new MomentLog();

    const firstAction = anAction("FIRST");
    momentLog.append(firstAction.forward, firstAction.reverse);

    const secondAction = anAction("SECOND");
    momentLog.append(secondAction.forward, secondAction.reverse);

    const thirdAction = anAction("THIRD");
    momentLog.append(thirdAction.forward, thirdAction.reverse);

    momentLog.undo();

    expect(momentLog.fetchUpToAndIncluding(1)).toHaveLength(2);
    expect(momentLog.fetchUpToAndIncluding(10)).toHaveLength(2);

    momentLog.redo();

    expect(momentLog.fetchUpToAndIncluding(10)).toHaveLength(3);
    expect(momentLog.fetchUpToAndIncluding(1)).toHaveLength(2);

    expect(momentLog.fetchUpToAndIncluding(0)).toHaveLength(1);
  });

  it("can filter from exclusive pointer", () => {
    const momentLog = new MomentLog();

    const firstAction = anAction("FIRST");
    momentLog.append(firstAction.forward, firstAction.reverse);

    const secondAction = anAction("SECOND");
    momentLog.append(secondAction.forward, secondAction.reverse);

    const thirdAction = anAction("THIRD");
    momentLog.append(thirdAction.forward, thirdAction.reverse);

    momentLog.undo();

    expect(momentLog.fetchAfter(1)).toHaveLength(0);

    momentLog.redo();

    expect(momentLog.fetchAfter(1)).toHaveLength(1);

    expect(momentLog.fetchAfter(10)).toHaveLength(0);
    expect(momentLog.fetchAfter(0)).toHaveLength(2);
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
