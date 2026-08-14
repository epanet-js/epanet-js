import { captureError } from "src/infra/error-tracking";

const CHANNEL_NAME = "epanet-auth";
const USER_CHANGED = "userChanged";

type UserChangedMessage = { type: typeof USER_CHANGED };

let channel: BroadcastChannel | null | undefined;

export const notifyUserChanged = (): void => {
  const target = getChannel();
  if (!target) return;

  const message: UserChangedMessage = { type: USER_CHANGED };

  try {
    target.postMessage(message);
  } catch (error) {
    captureError(error as Error);
  }
};

export const subscribeToUserChanged = (handler: () => void): (() => void) => {
  const target = getChannel();
  if (!target) return () => {};

  const listener = (event: MessageEvent) => {
    if (!isUserChanged(event.data)) return;

    handler();
  };

  target.addEventListener("message", listener);

  return () => {
    target.removeEventListener("message", listener);
  };
};

const getChannel = (): BroadcastChannel | null => {
  if (channel !== undefined) return channel;

  if (typeof BroadcastChannel === "undefined") {
    channel = null;
    return channel;
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (error) {
    captureError(error as Error);
    channel = null;
  }

  return channel;
};

const isUserChanged = (data: unknown): data is UserChangedMessage =>
  !!data &&
  typeof data === "object" &&
  (data as UserChangedMessage).type === USER_CHANGED;
