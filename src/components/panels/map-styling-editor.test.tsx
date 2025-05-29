import { screen, render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { MapStylingEditor } from "./map-styling-editor";
import { Store } from "src/state/jotai";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("Map Styling Editor", () => {
  it("can change the styles for nodes", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { elevation: 10 })
      .aJunction("J2", { elevation: 15 })
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    expect(
      screen.getByRole("combobox", { name: /nodes color by/i }),
    ).toHaveTextContent("None");

    await user.click(screen.getByRole("combobox", { name: /nodes color by/i }));
    await user.click(screen.getByText("Elevation"));

    expect(
      screen.getByRole("button", { name: /pretty breaks, 5/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pretty breaks, 5/i }));

    await user.click(screen.getByRole("combobox", { name: /mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: "4" }));

    expect(
      screen.getByRole("button", { name: /equal intervals, 4/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /node ramp/i }));
    await user.click(screen.getByTitle("OrRd"));
    await user.keyboard("{Escape}");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /nodes labels/i }),
    );

    expect(
      screen.getByRole("checkbox", { name: /nodes labels/i }),
    ).toBeChecked();
  });

  it("can change the styles for links", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1", { diameter: 10 })
      .aPipe("P2", { diameter: 15 })
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    expect(
      screen.getByRole("combobox", { name: /links color by/i }),
    ).toHaveTextContent("None");

    await user.click(screen.getByRole("combobox", { name: /links color by/i }));
    await user.click(screen.getByText("Diameter"));

    expect(
      screen.getByRole("button", { name: /pretty breaks, 7/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pretty breaks, 7/i }));

    await user.click(screen.getByRole("combobox", { name: /mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: "4" }));

    expect(
      screen.getByRole("button", { name: /equal intervals, 4/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /link ramp/i }));
    await user.click(screen.getByTitle("OrRd"));
    await user.keyboard("{Escape}");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /links labels/i }),
    );

    expect(
      screen.getByRole("checkbox", { name: /links labels/i }),
    ).toBeChecked();
  });

  it("disables options that need a simulation", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1")
      .aPipe("P2")
      .aJunction("J1")
      .aJunction("J2")
      .build();
    const store = setInitialState({
      hydraulicModel,
    });
    renderComponent(store);

    await user.click(screen.getByRole("combobox", { name: /links color by/i }));
    expect(screen.getByRole("option", { name: /flow/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("combobox", { name: /nodes color by/i }));
    expect(screen.getByRole("option", { name: /pressure/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <MapStylingEditor />
      </JotaiProvider>,
    );
  };
});
