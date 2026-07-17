import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { geocodingQueryClient } from "src/lib/geocoding";
import { captureError } from "src/infra/error-tracking";
import { ProjectionSearch } from "./projection-search";

vi.mock("src/infra/error-tracking", () => ({
  captureError: vi.fn(),
}));

const aFeature = (name: string) => ({
  place_name: name,
  center: [-0.37, 39.46],
  bbox: [-0.43, 39.28, -0.27, 39.56],
});

const successResponse = (features: unknown[]) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ features }),
  }) as unknown as Response;

const errorResponse = (status: number, body = "") =>
  ({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as Response;

const renderSearch = () => {
  const onSearchError = vi.fn();
  const onLocationSelect = vi.fn();
  render(
    <ProjectionSearch
      projections={[]}
      onLocationSelect={onLocationSelect}
      onProjectionSelect={vi.fn()}
      onSearched={vi.fn()}
      onSearchError={onSearchError}
    />,
  );
  return { onSearchError, onLocationSelect };
};

describe("ProjectionSearch", () => {
  beforeEach(() => {
    geocodingQueryClient.clear();
    vi.clearAllMocks();
    stubFeatureOn("FLAG_GEOCODING_RESILIENCE");
  });

  it("debounces typing into a single geocoding request", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(successResponse([aFeature("Valencia, Spain")]));
    const user = userEvent.setup();
    const { onSearchError } = renderSearch();

    await user.type(screen.getByRole("textbox"), "valencia");

    expect(await screen.findByText("Valencia, Spain")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onSearchError).toHaveBeenCalledWith(false);
  });

  it("reports an error when the request fails with a client error", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(errorResponse(401, "Not Authorized - Invalid Token"));
    const user = userEvent.setup();
    const { onSearchError } = renderSearch();

    await user.type(screen.getByRole("textbox"), "madrid");

    await waitFor(() => {
      expect(onSearchError).toHaveBeenCalledWith(true);
    });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
      geocoding: {
        query: "madrid",
        status: 401,
        responseBody: "Not Authorized - Invalid Token",
      },
    });
  });

  it("clears the error once a search succeeds again", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(404, "Not Found"))
      .mockResolvedValue(successResponse([aFeature("Lisbon, Portugal")]));
    const user = userEvent.setup();
    const { onSearchError } = renderSearch();

    const input = screen.getByRole("textbox");
    await user.type(input, "lisbo");
    await waitFor(() => {
      expect(onSearchError).toHaveBeenCalledWith(true);
    });

    await user.type(input, "n");

    expect(await screen.findByText("Lisbon, Portugal")).toBeInTheDocument();
    expect(onSearchError).toHaveBeenLastCalledWith(false);
  });
});
