import { ScrollState } from "../hooks/use-scroll-state";

type Props = {
  scrollState: ScrollState;
  gutterWidth: number;
  actionsWidth: number;
  rowHeight: number;
};

export function ScrollShadows({
  scrollState,
  gutterWidth,
  actionsWidth,
  rowHeight,
}: Props) {
  return (
    <>
      {scrollState.hasVerticalScroll && (
        <>
          <ScrollShadow
            position="top"
            topOffset={rowHeight}
            startEdge={gutterWidth}
            endEdge={actionsWidth + scrollState.scrollbarWidth}
          />
          <ScrollShadow
            position="bottom"
            offset={scrollState.scrollbarHeight}
            startEdge={gutterWidth}
            endEdge={actionsWidth + scrollState.scrollbarWidth}
          />
        </>
      )}
      {scrollState.hasHorizontalScroll && (
        <>
          <ScrollShadow
            position="left"
            topOffset={rowHeight}
            offset={gutterWidth}
            endEdge={scrollState.scrollbarHeight}
          />
          <ScrollShadow
            position="right"
            topOffset={rowHeight}
            offset={actionsWidth + scrollState.scrollbarWidth}
            endEdge={scrollState.scrollbarHeight}
          />
        </>
      )}
    </>
  );
}

function ScrollShadow({
  position,
  offset = 0,
  topOffset = 0,
  startEdge = 0,
  endEdge = 0,
}: {
  position: "top" | "bottom" | "left" | "right";
  offset?: number;
  topOffset?: number;
  startEdge?: number;
  endEdge?: number;
}) {
  const isHorizontal = position === "top" || position === "bottom";

  return (
    <div
      className="absolute pointer-events-none z-20 datagrid-scroll-shadow"
      data-position={position}
      style={{
        background: gradients[position],
        ...(isHorizontal
          ? { height: 10, left: startEdge, right: endEdge }
          : { width: 10, top: topOffset, bottom: endEdge }),
        ...(position === "top" && { top: topOffset }),
        ...(position === "bottom" && { bottom: offset }),
        ...(position === "left" && { left: offset }),
        ...(position === "right" && { right: offset }),
      }}
    />
  );
}

const gradients = {
  top: "radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent)",
  bottom:
    "radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent)",
  left: "radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.12), transparent)",
  right:
    "radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.12), transparent)",
};
