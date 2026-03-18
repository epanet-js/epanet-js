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
        "group flex flex-col justify-center items-center rounded-sm",
        "w-32 aspect-video",
        "group-hover:ring group-hover:ring-2 group-hover:ring-purple-300",
        "focus:ring focus:ring-2 focus:ring-purple-300",
        "data-state-on:ring data-state-on:ring-2 data-state-on:ring-purple-500",
        mapboxLayer.thumbnailClass,
      )}
    />
  );
}
