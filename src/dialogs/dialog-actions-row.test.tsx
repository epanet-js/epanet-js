import { act, createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDialogState } from "../components/dialog";
import { DialogActions, DialogActionsHandle } from "./dialog-actions-row";

vi.mock("src/components/dialog", () => ({
  useDialogState: vi.fn(() => ({
    closeDialog: vi.fn(),
  })),
}));

const setupUser = () => userEvent.setup();

const mockCloseDialog = () => {
  const closeDialog = vi.fn();
  vi.mocked(useDialogState).mockReturnValue({ closeDialog });
  return closeDialog;
};

describe("DialogActions", () => {
  describe("default state (no changes)", () => {
    it("renders save and cancel buttons", () => {
      mockCloseDialog();
      render(<DialogActions />);

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    });

    it("closes the dialog when clicking cancel", async () => {
      const user = setupUser();
      const closeDialog = mockCloseDialog();
      const onClose = vi.fn();

      render(<DialogActions onClose={onClose} />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledWith(false);
      expect(closeDialog).toHaveBeenCalled();
    });

    it("closes the dialog when clicking save with no changes", () => {
      const closeDialog = mockCloseDialog();
      const onClose = vi.fn();
      const onSave = vi.fn();
      const ref = createRef<DialogActionsHandle>();

      render(<DialogActions ref={ref} onClose={onClose} onSave={onSave} />);
      act(() => ref.current!.saveDialog());

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledWith(false);
      expect(closeDialog).toHaveBeenCalled();
    });
  });

  describe("with pending changes", () => {
    it("enables the save button", () => {
      mockCloseDialog();
      render(<DialogActions hasChanges />);

      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    it("shows discard confirmation when clicking cancel", async () => {
      const user = setupUser();
      mockCloseDialog();

      render(<DialogActions hasChanges />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Discard changes" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Keep editing" }),
      ).toBeInTheDocument();
    });

    it("returns to normal view when clicking keep editing", async () => {
      const user = setupUser();
      mockCloseDialog();

      render(<DialogActions hasChanges />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("discards changes and closes the dialog", async () => {
      const user = setupUser();
      const closeDialog = mockCloseDialog();
      const onClose = vi.fn();

      render(<DialogActions hasChanges onClose={onClose} />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(onClose).toHaveBeenCalledWith(true);
      expect(closeDialog).toHaveBeenCalled();
    });

    it("saves changes and closes the dialog", async () => {
      const user = setupUser();
      const closeDialog = mockCloseDialog();
      const onSave = vi.fn();

      render(<DialogActions hasChanges onSave={onSave} />);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).toHaveBeenCalledWith(false);
      expect(closeDialog).toHaveBeenCalled();
    });
  });

  describe("with warnings", () => {
    it("shows save warning when clicking save", async () => {
      const user = setupUser();
      mockCloseDialog();

      render(<DialogActions hasChanges hasWarnings />);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByText(/validation warnings/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Keep editing" }),
      ).toBeInTheDocument();
    });

    it("returns to normal view when clicking keep editing on save warning", async () => {
      const user = setupUser();
      mockCloseDialog();

      render(<DialogActions hasChanges hasWarnings />);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });

    it("saves with warnings when confirming", async () => {
      const user = setupUser();
      const closeDialog = mockCloseDialog();
      const onSave = vi.fn();

      render(<DialogActions hasChanges hasWarnings onSave={onSave} />);
      await user.click(screen.getByRole("button", { name: "Save" }));
      // The danger "Save" button in the warning confirmation
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(onSave).toHaveBeenCalledWith(true);
      expect(closeDialog).toHaveBeenCalled();
    });
  });

  describe("read-only mode", () => {
    it("renders only a close button", () => {
      mockCloseDialog();
      render(<DialogActions readOnly />);

      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });

    it("closes the dialog when clicking close", async () => {
      const user = setupUser();
      const closeDialog = mockCloseDialog();
      const onClose = vi.fn();

      render(<DialogActions readOnly onClose={onClose} />);
      await user.click(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledWith(false);
      expect(closeDialog).toHaveBeenCalled();
    });
  });

  describe("imperative handle", () => {
    it("closeDialog triggers the discard confirmation when there are changes", () => {
      mockCloseDialog();
      const ref = createRef<DialogActionsHandle>();

      render(<DialogActions ref={ref} hasChanges />);
      act(() => ref.current!.closeDialog());

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });

    it("closeDialog closes directly when there are no changes", () => {
      const closeDialog = mockCloseDialog();
      const ref = createRef<DialogActionsHandle>();

      render(<DialogActions ref={ref} />);
      act(() => ref.current!.closeDialog());

      expect(closeDialog).toHaveBeenCalled();
    });

    it("saveDialog triggers the save warning when there are warnings", () => {
      mockCloseDialog();
      const ref = createRef<DialogActionsHandle>();

      render(<DialogActions ref={ref} hasChanges hasWarnings />);
      act(() => ref.current!.saveDialog());

      expect(screen.getByText(/validation warnings/i)).toBeInTheDocument();
    });
  });
});
