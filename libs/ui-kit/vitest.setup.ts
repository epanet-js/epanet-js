import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, vi } from "vitest";

expect.extend(matchers);

// jsdom is missing DOM APIs that the selector + Radix popover rely on.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom performs no layout; @tanstack/virtual-core sizes the scroll viewport
// from these, and would otherwise virtualize every row away.
Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get: () => 300,
});
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get: () => 180,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
