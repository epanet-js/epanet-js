import {
  buildJunction,
  buildPipe,
} from "src/__helpers__/hydraulic-model-builder";
import { LinkSegment, calculateSegments } from "./link-segments";

describe("link segments", () => {
  it("calculates the midpoint of each segment", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    });

    const linkSegments = calculateSegments({
      putAssets: [pipe],
      deleteAssets: [],
    });

    const pipeSegments = linkSegments.get(pipe.id) as LinkSegment[];
    expect(pipeSegments.length).toEqual(2);
    const [first, second] = pipeSegments;
    expect(first.midpoint[0]).toBeCloseTo(0.5);
    expect(first.midpoint[1]).toBeCloseTo(0.5);
    expect(second.midpoint[0]).toBeCloseTo(1.5);
    expect(second.midpoint[1]).toBeCloseTo(1.5);
  });

  it("calculates the angle of each segment", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
        [0, 0],
      ],
    });

    const linkSegments = calculateSegments({
      putAssets: [pipe],
      deleteAssets: [],
    });

    const pipeSegments = linkSegments.get(pipe.id) as LinkSegment[];
    expect(pipeSegments.length).toEqual(2);
    const [first, second] = pipeSegments;
    expect(first.angle).toBeCloseTo(45);
    expect(second.angle).toBeCloseTo(225);
  });

  it("calculates the length of each segment", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    });

    const linkSegments = calculateSegments({
      putAssets: [pipe],
      deleteAssets: [],
    });

    const pipeSegments = linkSegments.get(pipe.id) as LinkSegment[];
    expect(pipeSegments.length).toEqual(2);
    const [first, second] = pipeSegments;
    expect(first.lengthInMeters).toBeCloseTo(157249.598);
    expect(second.lengthInMeters).toBeCloseTo(157225.649);
  });

  it("assigns an link id to the segment", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    const otherPipe = buildPipe({
      coordinates: [
        [0, 0],
        [2, 2],
      ],
    });

    const linkSegments = calculateSegments({
      putAssets: [pipe, otherPipe],
      deleteAssets: [],
    });

    const pipeSegments = linkSegments.get(pipe.id) as LinkSegment[];
    expect(pipeSegments[0].linkId).toEqual(pipe.id);

    const otherSegments = linkSegments.get(otherPipe.id) as LinkSegment[];
    expect(otherSegments[0].linkId).toEqual(otherPipe.id);
  });

  it("ignores nodes", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    const aNode = buildJunction();
    const linkSegments = calculateSegments({
      putAssets: [pipe, aNode],
      deleteAssets: [],
    });

    expect(linkSegments.has(pipe.id)).toBeTruthy();
    expect(linkSegments.has(aNode.id)).toBeFalsy();
  });

  it("preserves state of previous segments", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    const otherPipe = buildPipe({
      coordinates: [
        [0, 0],
        [2, 2],
      ],
    });

    const firstSegments = calculateSegments({
      putAssets: [pipe],
      deleteAssets: [],
    });
    expect(firstSegments.has(pipe.id)).toBeTruthy();

    const secondSegments = calculateSegments(
      {
        putAssets: [otherPipe],
        deleteAssets: [],
      },
      firstSegments,
    );
    expect(secondSegments.has(pipe.id)).toBeTruthy();
    expect(secondSegments.has(otherPipe.id)).toBeTruthy();

    const thirdSegments = calculateSegments(
      {
        putAssets: [],
        deleteAssets: [otherPipe.id],
      },
      secondSegments,
    );

    expect(thirdSegments.has(pipe.id)).toBeTruthy();
    expect(thirdSegments.has(otherPipe.id)).toBeFalsy();
  });
});
