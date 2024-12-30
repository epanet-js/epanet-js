import { render, screen } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { AssetEditor } from "./feature_editor/feature_editor_inner";
import { Asset } from "src/hydraulic-model";
import { buildPipe } from "src/__helpers__/hydraulic-model-builder";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { UIDMap } from "src/lib/id_mapper";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("AssetEditor", () => {
  describe("with a pipe", () => {
    it("can show a pipe", () => {
      stubFeatureOn("FLAG_EDIT_PROPS");
      const asset = buildPipe({
        length: 10,
        diameter: 100.1,
        roughness: 1,
        minorLoss: 0.1,
        status: "open",
      });

      renderComponent({ asset });

      expect(screen.getByText(/pipe/i)).toBeInTheDocument();

      expect(
        screen.getByRole("textbox", { name: /key: status/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: /value for: status/i }),
      ).toHaveTextContent("Open");

      expect(
        screen.getByRole("textbox", { name: /key: diameter \(mm\)/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: diameter/i }),
      ).toHaveValue("100");

      expect(
        screen.getByRole("textbox", { name: /key: roughness/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: roughness/i }),
      ).toHaveValue("1.00");

      expect(
        screen.getByRole("textbox", { name: /key: length \(m\)/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: length/i }),
      ).toHaveValue("10.00");

      expect(
        screen.getByRole("textbox", { name: /key: loss coeff/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: loss coeff/i }),
      ).toHaveValue("0.100");

      expect(
        screen.getByRole("textbox", { name: /key: flow \(l\/s\)/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: flow/i }),
      ).toHaveValue("Not available");
    });

    it("can show a pipe with simulation", () => {
      const simulationProvider = { getFlow: () => 20 };
      const asset = buildPipe();
      asset.setSimulation(simulationProvider);

      renderComponent({ asset });

      expect(
        screen.getByRole("textbox", { name: /key: flow \(l\/s\)/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: /value for: flow/i }),
      ).toHaveValue("20.0");
    });
  });

  const renderComponent = ({
    store = getDefaultStore(),
    asset = buildPipe(),
    quantitiesMetadata = new Quantities(presets.si),
  }: Partial<{
    asset: Asset;
    store: Store;
    quantitiesMetadata: Quantities;
  }> = {}) => {
    const idMap = UIDMap.empty();
    return render(
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
          <AssetEditor asset={asset} quantitiesMetadata={quantitiesMetadata} />
        </PersistenceContext.Provider>
      </JotaiProvider>,
    );
  };
});
