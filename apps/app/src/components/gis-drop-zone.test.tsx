import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { GisDropZone, type GisFiles } from "./gis-drop-zone";

const renderDropZone = (selectedFiles: GisFiles = {}) => {
  const onFileDrop = vi.fn();
  render(
    <GisDropZone
      onFileDrop={onFileDrop}
      supportedFormats={["geojson", "shapefile", "dxf"]}
      selectedFiles={selectedFiles}
    />,
  );
  return { onFileDrop };
};

const upload = async (file: File) => {
  const input = document.querySelector('input[type="file"]')!;
  await userEvent.upload(input as HTMLInputElement, file);
};

describe("GisDropZone", () => {
  it("takes a DXF drawing as a source of its own", async () => {
    const { onFileDrop } = renderDropZone();
    const dxf = aTestFile({ filename: "site.dxf", content: "0\nEOF" });

    await upload(dxf);

    expect(onFileDrop).toHaveBeenCalledWith({ dxf });
  });

  it("names a selected DXF as a drawing, not as a shapefile", () => {
    renderDropZone({ dxf: aTestFile({ filename: "site.dxf" }) });

    expect(screen.getByText("site.dxf")).toBeInTheDocument();
    expect(screen.getByText("DXF")).toBeInTheDocument();
    expect(screen.queryByText(/\.shp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dbf/i)).not.toBeInTheDocument();
  });

  it("still waits for the parts of a shapefile", () => {
    renderDropZone({ shp: aTestFile({ filename: "mains.shp" }) });

    expect(screen.getByText("mains.shp")).toBeInTheDocument();
    expect(screen.getByText("DBF")).toBeInTheDocument();
  });
});
