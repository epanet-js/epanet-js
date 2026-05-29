import clsx from "clsx";

export function Thumbnail({
  mapboxLayer,
}: {
  mapboxLayer: {
    thumbnailClass: string;
  };
}) {
  return (
    <div
      className={clsx(
        "group flex flex-col justify-center items-center rounded-xs",
        "w-32 aspect-video",
        "group-hover:ring-3 group-hover:ring-2 group-hover:ring-purple-300",
        "focus:ring-3 focus:ring-2 focus:ring-purple-300",
        "data-[state=on]:ring-3 data-[state=on]:ring-2 data-[state=on]:ring-accent",
        mapboxLayer.thumbnailClass,
      )}
    />
  );
}
