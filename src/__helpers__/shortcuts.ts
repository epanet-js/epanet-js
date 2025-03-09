import Mousetrap from "mousetrap";

export const triggerShortcut = (combo: string) => {
  Mousetrap.trigger(combo);
};
