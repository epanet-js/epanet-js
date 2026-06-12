/**
 * Shared chrome for floating map overlays under FLAG_DRAWING_TOOLBAR.
 *
 * Combines the "rounded feel" of the native map controls (mapbox uses a 4px
 * radius, i.e. Tailwind `rounded-sm`) with the toolbar's drop shadow, so every
 * overlay — drawing toolbar, legends, hints, timestep warning, satellite
 * toggle and the native zoom/scale controls — shares one consistent look.
 */
export const mapOverlayShadow = "shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]";

export const mapOverlayClass = `rounded-sm border ${mapOverlayShadow}`;
