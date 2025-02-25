import { screen, waitFor } from "@testing-library/react";

export const waitForNotLoading = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
};
