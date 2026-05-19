import { getWorker, timedWith } from "src/lib/ejsdb";

export const exportDb = async (): Promise<Blob> => {
  return timedWith(
    "exportDb",
    async () => {
      const worker = getWorker();
      const bytes = await worker.exportDb();
      return new Blob([bytes], { type: "application/octet-stream" });
    },
    (blob) => ({ bytes: blob.size }),
  );
};
