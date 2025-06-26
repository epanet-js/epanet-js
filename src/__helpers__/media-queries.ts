import { useBreakpoint } from "../hooks/use-breakpoint";

vi.mock("../hooks/use-breakpoint", () => ({
  useBreakpoint: vi.fn(),
}));

const mockedUseBreakpoint = vi.mocked(useBreakpoint);

mockedUseBreakpoint.mockReturnValue(true);

const sizes = ["xs", "sm", "md", "lg", "xl", "2xl"];
type Size = (typeof sizes)[number];

export const stubWindowSize = (size: Size) => {
  mockedUseBreakpoint.mockImplementation((breakpoint: Size) => {
    const testedBreakpointIndex = sizes.indexOf(breakpoint);

    const simulatedBreakpointIndex = sizes.indexOf(size);

    return (
      testedBreakpointIndex !== -1 &&
      testedBreakpointIndex <= simulatedBreakpointIndex
    );
  });
};
