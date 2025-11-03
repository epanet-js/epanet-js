import { Feature, LineString, Point } from "geojson";
import { QueryProvider, getClickedFeature } from "./fuzzy-click";

describe("get clicked feature", () => {
  it("queries the map to fetch rendered features", () => {
    const mapStub = stubMapQuery();
    const point = { x: 10, y: 10 };

    getClickedFeature(mapStub, point);

    expect(mapStub.queryRenderedFeatures).toHaveBeenCalledWith(
      point,
      expect.anything(),
    );
  });

  it("prioritizes points over lines", () => {
    const lineId = 1 as RawId;
    const pointId = 2 as RawId;
    const mapStub = stubMapQuery([aLineString(lineId), aPoint(pointId)]);
    const point = { x: 10, y: 10 };

    const id = getClickedFeature(mapStub, point);

    expect(id).toEqual(pointId);
  });

  it("extends the query to a wider area when no results", () => {
    const pointId = 2 as RawId;
    const mapStub = {
      queryRenderedFeatures: vi
        .fn()
        .mockReturnValueOnce([])
        .mockReturnValueOnce([aPoint(pointId)]),
    };
    const point = { x: 10, y: 10 };

    const id = getClickedFeature(mapStub, point);

    expect(mapStub.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [0, 0],
        [20, 20],
      ],
      expect.anything(),
    );
    expect(id).toEqual(pointId);
  });

  it("ignores hidden features", () => {
    const mapStub = stubMapQuery([aHiddenPoint()]);
    const point = { x: 10, y: 10 };

    const ids = getClickedFeature(mapStub, point);

    expect(ids).toBeNull();
  });

  const stubMapQuery = (features: Feature[] = []): QueryProvider => {
    const mapStub = {
      queryRenderedFeatures: vi.fn().mockReturnValue(features),
    };
    return mapStub;
  };

  const aLineString = (id: RawId): Feature<LineString> => {
    return {
      id,
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 0],
        ],
      },
      properties: {},
    };
  };

  const aHiddenPoint = (id = 1) => {
    return { ...aPoint(id), state: { hidden: true } };
  };

  const aPoint = (id: RawId): Feature<Point> => {
    return {
      id,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
      properties: {},
    };
  };
});
