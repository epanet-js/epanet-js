import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { MomentLog } from "src/lib/persistence/moment-log";
import { Store } from "src/state";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { recentFilesStoreAtom } from "src/state/file-system";
import { setInitialState } from "src/__helpers__/state";
import { AuthMockProvider } from "src/__helpers__/auth-mock";
import { buildFileSystemHandleMock } from "src/__helpers__/browser-fs-mock";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { CommandContainer } from "./__helpers__/command-container";
import { useSignOut } from "./sign-out";

let importProjectFails = false;

vi.mock("src/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("src/lib/db")>();
  return {
    ...original,
    importProject: (input: Parameters<typeof original.importProject>[0]) =>
      importProjectFails
        ? Promise.reject(new Error("db exploded"))
        : original.importProject(input),
  };
});

const aMoment = (name: string) => ({ note: name });

describe("sign out", () => {
  useInProcessDb();

  beforeEach(() => {
    importProjectFails = false;
  });

  it("clears the model", async () => {
    const IDS = { J1: 1 } as const;
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
    });

    renderComponent({ store });
    await triggerSignOut();

    await waitFor(() => {
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(0);
    });
  });

  it("lands on welcome", async () => {
    const store = setInitialState({});

    renderComponent({ store });
    await triggerSignOut();

    await waitFor(() => {
      expect(store.get(dialogAtom)).toEqual({ type: "welcome" });
    });
  });

  it("keeps the recent files", async () => {
    const store = setInitialState({});
    const handle = buildFileSystemHandleMock({ fileName: "my-project.ejsdb" });
    await store.get(recentFilesStoreAtom).add("my-project.ejsdb", handle);

    renderComponent({ store });
    await triggerSignOut();

    await waitFor(() => {
      expect(store.get(dialogAtom)).toEqual({ type: "welcome" });
    });

    const entries = await store.get(recentFilesStoreAtom).getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toEqual("my-project.ejsdb");
  });

  it("asks to discard when there are unsaved changes", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      momentLog: aMomentLogWithChanges(),
    });

    renderComponent({ store, signOut });
    await triggerSignOut();

    expect(
      await screen.findByRole("button", { name: /discard/i }),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps the session when the discard is canceled", async () => {
    const IDS = { J1: 1 } as const;
    const signOut = vi.fn().mockResolvedValue(undefined);
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      momentLog: aMomentLogWithChanges(),
    });

    renderComponent({ store, signOut });
    await triggerSignOut();
    await userEvent.click(
      await screen.findByRole("button", { name: /cancel/i }),
    );

    expect(signOut).not.toHaveBeenCalled();
    expect(store.get(stagingModelDerivedAtom).assets.get(IDS.J1)).toBeDefined();
  });

  it("signs out once the teardown finished", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    });
    let assetsWhenSignedOut: number | null = null;
    const signOut = vi.fn().mockImplementation(() => {
      assetsWhenSignedOut = store.get(stagingModelDerivedAtom).assets.size;
      return Promise.resolve();
    });

    renderComponent({ store, signOut });
    await triggerSignOut();

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
    expect(assetsWhenSignedOut).toEqual(0);
  });

  it("signs out even when the teardown fails", async () => {
    importProjectFails = true;
    const signOut = vi.fn().mockResolvedValue(undefined);
    const store = setInitialState({});

    renderComponent({ store, signOut });
    await triggerSignOut();

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
    expect(store.get(dialogAtom)).toEqual({ type: "welcome" });
  });

  const triggerSignOut = async () => {
    await userEvent.click(screen.getByRole("button", { name: "signOut" }));
  };

  const aMomentLogWithChanges = () => {
    const momentLog = new MomentLog();
    momentLog.append(aMoment("A"), aMoment("B"));
    return momentLog;
  };

  const TestableComponent = () => {
    const signOut = useSignOut();

    return (
      <button
        aria-label="signOut"
        onClick={() => signOut({ source: "userMenu" })}
      >
        Sign out
      </button>
    );
  };

  const renderComponent = ({
    store,
    signOut = vi.fn().mockResolvedValue(undefined),
  }: {
    store: Store;
    signOut?: () => Promise<void>;
  }) => {
    render(
      <AuthMockProvider signOut={signOut}>
        <CommandContainer store={store}>
          <TestableComponent />
        </CommandContainer>
      </AuthMockProvider>,
    );
  };
});
