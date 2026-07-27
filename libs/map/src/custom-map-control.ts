import mapboxgl from "mapbox-gl";

export const FIT_TO_EXTENT_CONTROL = "fit-to-extent";
export const FIT_TO_EXTENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>`;

export type CustomMapControlClick = {
  name: string;
  map: mapboxgl.Map;
};

export type CustomMapControlOptions = {
  name: string;
  title: string;
  icon: string;
};

export class CustomMapControl implements mapboxgl.IControl {
  private container: HTMLDivElement | null = null;
  private map: mapboxgl.Map | null = null;
  private options: CustomMapControlOptions;
  private onClick: (event: CustomMapControlClick) => void;

  constructor(
    options: CustomMapControlOptions,
    onClick: (event: CustomMapControlClick) => void,
  ) {
    this.options = options;
    this.onClick = onClick;
  }

  onAdd(map: mapboxgl.Map): HTMLElement {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.title = this.options.title;
    button.setAttribute("aria-label", this.options.title);
    button.className = "mapboxgl-ctrl-icon";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.innerHTML = this.options.icon;
    button.addEventListener("click", () => {
      if (this.map) {
        this.onClick({ name: this.options.name, map: this.map });
      }
    });
    button.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    this.container.appendChild(button);
    return this.container;
  }

  onRemove(): void {
    this.container?.remove();
    this.map = null;
  }
}
