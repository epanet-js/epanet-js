import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Store } from "src/state";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { buildFileSystemHandleMock } from "src/__helpers__/browser-fs-mock";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { userSettingsAtom } from "src/state/user-settings";
import type { RecentFileEntry } from "src/lib/recent-files";
import { useOpenRecentFile } from "./open-recent-file";

describe("openRecentFile", () => {
  describe("with FLAG_FILE_PERMISSIONS on", () => {
    it("shows the info dialog and defers the permission request until acknowledged", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      const store = setInitialState();
      const entry = aRecentFileEntry();

      renderComponent({ store, entry });
      await triggerOpen();

      await waitFor(() => {
        expect(screen.getByText(/grant access to your file/i)).toBeVisible();
      });
      expect(entry.handle.requestPermission).not.toHaveBeenCalled();

      await userEvent.click(
        screen.getByRole("button", { name: /understood/i }),
      );

      await waitFor(() => {
        expect(entry.handle.requestPermission).toHaveBeenCalledWith({
          mode: "read",
        });
      });
      expect(store.get(userSettingsAtom).showFilePermissionsInfo).toBe(true);
    });

    it("stops showing the dialog when the user opts out via the checkbox", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      const store = setInitialState();
      const entry = aRecentFileEntry();

      renderComponent({ store, entry });
      await triggerOpen();

      await waitFor(() => {
        expect(screen.getByText(/grant access to your file/i)).toBeVisible();
      });

      await userEvent.click(screen.getByRole("checkbox"));
      await userEvent.click(
        screen.getByRole("button", { name: /understood/i }),
      );

      await waitFor(() => {
        expect(store.get(userSettingsAtom).showFilePermissionsInfo).toBe(false);
      });
    });

    it("skips the info dialog when permission is already granted", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      const store = setInitialState();
      const entry = aRecentFileEntry({ queryState: "granted" });

      renderComponent({ store, entry });
      await triggerOpen();

      await waitFor(() => {
        expect(entry.handle.requestPermission).toHaveBeenCalledWith({
          mode: "read",
        });
      });
      expect(screen.queryByText(/grant access to your file/i)).toBeNull();
    });

    it("skips the info dialog when the user has opted out of it", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      const store = setInitialState();
      store.set(userSettingsAtom, {
        ...store.get(userSettingsAtom),
        showFilePermissionsInfo: false,
      });
      const entry = aRecentFileEntry();

      renderComponent({ store, entry });
      await triggerOpen();

      await waitFor(() => {
        expect(entry.handle.requestPermission).toHaveBeenCalledWith({
          mode: "read",
        });
      });
      expect(screen.queryByText(/grant access to your file/i)).toBeNull();
    });
  });

  describe("with FLAG_FILE_PERMISSIONS off", () => {
    it("requests permission directly without showing the info dialog", async () => {
      stubFeatureOff("FLAG_FILE_PERMISSIONS");
      const store = setInitialState();
      const entry = aRecentFileEntry();

      renderComponent({ store, entry });
      await triggerOpen();

      await waitFor(() => {
        expect(entry.handle.requestPermission).toHaveBeenCalledWith({
          mode: "read",
        });
      });
      expect(screen.queryByText(/grant access to your file/i)).toBeNull();
    });
  });
});

const triggerOpen = async () => {
  await userEvent.click(screen.getByRole("button", { name: "openRecent" }));
};

const aRecentFileEntry = ({
  queryState = "prompt",
}: { queryState?: PermissionState } = {}): RecentFileEntry => {
  const handle = buildFileSystemHandleMock({ fileName: "my-network.inp" });
  Object.assign(handle, {
    queryPermission: vi.fn(() => Promise.resolve(queryState)),
    requestPermission: vi.fn(() =>
      Promise.resolve("denied" as PermissionState),
    ),
  });
  return { id: "1", name: "my-network.inp", openedAt: 0, handle };
};

const TestableComponent = ({ entry }: { entry: RecentFileEntry }) => {
  const openRecentFile = useOpenRecentFile();

  return (
    <button
      aria-label="openRecent"
      onClick={() => openRecentFile(entry, "toolbar")}
    >
      Open recent
    </button>
  );
};

const renderComponent = ({
  store,
  entry,
}: {
  store: Store;
  entry: RecentFileEntry;
}) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent entry={entry} />
    </CommandContainer>,
  );
};
