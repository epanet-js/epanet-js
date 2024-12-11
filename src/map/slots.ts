export type Slot = "after-lines-slot";

export const slots: Record<Slot, Slot> = {
  "after-lines-slot": "after-lines-slot",
};

export const slotLayer = (id: Slot): mapboxgl.BackgroundLayer => ({
  id,
  type: "background",
  layout: { visibility: "none" },
});
