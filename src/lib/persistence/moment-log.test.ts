import { describe, expect, it } from "vitest";
import { MomentLog, generateStateId, initId } from "./moment-log";
import { fMoment } from "./moment";

describe("MomentLog", () => {
  it("registers to the history of moments", () => {
    const { forward, reverse, stateId } = anAction();
    const momentLog = new MomentLog();

    momentLog.append(forward, reverse, stateId);

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual({ stateId: initId, moment: reverse });
    expect(momentLog.nextRedo()).toEqual(null);
  });

  it("can undo / redo ", () => {
    const { forward, reverse, stateId } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse, stateId);

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual({ moment: forward, stateId });

    momentLog.redo();

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual({ moment: reverse, stateId: initId });
    expect(momentLog.nextRedo()).toEqual(null);
  });

  it("does nothing when cannot undo more", () => {
    const { forward, reverse, stateId } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse, stateId);

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual({ moment: forward, stateId });

    momentLog.undo();

    expect(momentLog.last()).toEqual(null);
    expect(momentLog.nextUndo()).toEqual(null);
    expect(momentLog.nextRedo()).toEqual({ moment: forward, stateId });
  });

  it("does nothing when cannot redo more", () => {
    const { forward, reverse } = anAction();
    const momentLog = new MomentLog();
    momentLog.append(forward, reverse);

    momentLog.undo();

    momentLog.redo();
    momentLog.redo();

    expect(momentLog.last()).toEqual(forward);
    expect(momentLog.nextUndo()).toEqual({ moment: reverse, stateId: initId });
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

  it("can define a snapshot as initial state", () => {
    const importMoment = anAction("IMPORT").forward;
    const momentLog = new MomentLog();
    momentLog.setSnapshot(importMoment, "s-0");

    const snapshot = momentLog.getSnapshot();
    expect(snapshot!.moment).toEqual(importMoment);
    expect(snapshot!.stateId).toEqual("s-0");

    expect(momentLog.nextUndo()).toBeNull();

    const firstAction = anAction("FIRST");
    momentLog.append(firstAction.forward, firstAction.reverse);

    momentLog.undo();

    expect(momentLog.nextUndo()).toBeNull();

    const copy = momentLog.copy();

    const snapshotCopy = copy.getSnapshot();
    expect(snapshotCopy!.moment).toEqual(importMoment);
    expect(snapshotCopy!.stateId).toEqual("s-0");
  });

  it("can obtain deltas after a snapshot", () => {
    const importMoment = anAction("IMPORT").forward;
    const momentLog = new MomentLog();
    momentLog.setSnapshot(importMoment, "s-0");

    const firstAction = anAction("FIRST");
    momentLog.append(firstAction.forward, firstAction.reverse);

    const deltas = momentLog.getDeltas();
    expect(deltas).toHaveLength(1);
    const delta = deltas[0];
    expect(delta).toEqual(firstAction.forward);
    const copy = momentLog.copy();

    expect(copy.getDeltas()).toEqual(deltas);
  });

  const anAction = (name = "ANY_ACTION") => {
    return {
      stateId: generateStateId(),
      forward: aMoment(name + "_forward"),
      reverse: aMoment(name + "_reverse"),
    };
  };

  const aMoment = (name: string) => {
    return fMoment(name);
  };

  describe("getDeltasFrom", () => {
    it("returns empty array when pointer equals fromPointer", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      momentLog.append(action1.forward, action1.reverse);

      const deltas = momentLog.getDeltasFrom(0);
      expect(deltas).toEqual([]);
    });

    it("returns forward moments when pointer > fromPointer", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      const action3 = anAction("THIRD");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);
      momentLog.append(action3.forward, action3.reverse);

      const deltas = momentLog.getDeltasFrom(0);
      expect(deltas).toEqual([action2.forward, action3.forward]);
    });

    it("returns reverse moments when pointer < fromPointer (after undo)", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);

      momentLog.undo();

      const deltas = momentLog.getDeltasFrom(1);
      expect(deltas).toEqual([action2.reverse]);
    });

    it("returns multiple reverse moments for multiple undos", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      const action3 = anAction("THIRD");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);
      momentLog.append(action3.forward, action3.reverse);

      momentLog.undo();
      momentLog.undo();

      const deltas = momentLog.getDeltasFrom(2);
      expect(deltas).toEqual([action3.reverse, action2.reverse]);
    });

    it("returns empty array when fromPointer is -1 and pointer is -1", () => {
      const momentLog = new MomentLog();
      const deltas = momentLog.getDeltasFrom(-1);
      expect(deltas).toEqual([]);
    });

    it("returns all forward moments when fromPointer is -1 and log has entries", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);

      const deltas = momentLog.getDeltasFrom(-1);
      expect(deltas).toEqual([action1.forward, action2.forward]);
    });

    it("returns empty array when fromPointer exceeds deltas length and pointer is -1", () => {
      const momentLog = new MomentLog();
      // No entries, pointer = -1, fromPointer = 5 (out of bounds)
      const deltas = momentLog.getDeltasFrom(5);
      expect(deltas).toEqual([]);
    });

    it("clamps fromPointer when it exceeds deltas length", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);
      // pointer = 1, fromPointer = 10 (out of bounds, should clamp to 1)

      const deltas = momentLog.getDeltasFrom(10);
      expect(deltas).toEqual([]);
    });

    it("handles fromPointer out of bounds after undo", () => {
      const momentLog = new MomentLog();
      const action1 = anAction("FIRST");
      const action2 = anAction("SECOND");
      momentLog.append(action1.forward, action1.reverse);
      momentLog.append(action2.forward, action2.reverse);

      momentLog.undo();
      momentLog.undo();
      // pointer = -1, fromPointer = 5 (out of bounds)
      // Should clamp fromPointer to 1 (last valid index), then return reverse moments

      const deltas = momentLog.getDeltasFrom(5);
      expect(deltas).toEqual([action2.reverse, action1.reverse]);
    });
  });
});
