const defaultTheme = require("tailwindcss/defaultTheme");
// eslint-disable-next-line
const colors = require("tailwindcss/colors");
// eslint-disable-next-line
const plugin = require("tailwindcss/plugin");
// eslint-disable-next-line
const postcss = require("postcss");

module.exports = {
  jit: "enable",
  content: ["./{app,components,src,pages}/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    data: {
      "state-checked": 'state="checked"',
      "state-active": 'state="active"',
      "state-on": 'state="on"',
      "state-open": 'state="open"',
    },
    fontFamily: {
      sans: ["Inter", "sans-serif"],
      mono: ["Source Code Pro", "monospace"],
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: colors.black,
      white: colors.white,
      gray: colors.neutral,
      purple: colors.purple,
      yellow: colors.yellow,
      red: colors.red,
      green: colors.green,
      orange: colors.orange,
      blue: colors.blue,
      pink: colors.pink,
      lime: colors.lime,
      teal: colors.teal,
    },
    extend: {
      /*
       * Semantic tokens — use these instead of raw Tailwind shades.
       *
       * BACKGROUND
       *   bg-base              App/page background
       *   bg-panel             Cards, sidebars, dialogs
       *   bg-popover           Dropdowns, tooltips, floating UI
       *   bg-base-hover        Interactive hover fill
       *   bg-base-active       Interactive active/pressed fill
       *
       * TEXT
       *   text-default         Primary text
       *   text-subtle          Secondary/supporting text
       *   text-disabled        Disabled state text
       *
       * BORDER
       *   border               Default border
       *   border-strong        Emphasized border
       *
       * ACCENT
       *   bg-accent            Accent background (purple)
       *   text-accent          Accent text
       *
       * STATUS  (warning / error / success / info)
       *   bg-{status}-subtle   Tinted background
       *   border-{status}      Status border
       *   text-{status}        Status text
       *   text-{status}-icon   Icon color
       *
       * FONT SIZES
       *   text-size-heading-1  1.5rem
       *   text-size-heading-2  1.25rem
       *   text-size-heading-3  1.125rem
       *   text-size-base       0.875rem
       *   text-size-small      0.75rem
       */
      colors: {
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
        },
        base: {
          DEFAULT: "var(--color-background-base)",
          hover: "var(--color-background-hover)",
          active: "var(--color-background-active)",
        },
        panel: "var(--color-background-panel)",
        popover: "var(--color-background-popover)",
        "warning-subtle": "var(--color-warning-subtle)",
        "error-subtle": "var(--color-error-subtle)",
        "success-subtle": "var(--color-success-subtle)",
        "info-subtle": "var(--color-info-subtle)",
      },
      textColor: {
        default: "var(--color-text-default)",
        subtle: "var(--color-text-subtle)",
        disabled: "var(--color-text-disabled)",
        accent: "var(--color-accent-text)",
        warning: "var(--color-warning-text)",
        "warning-icon": "var(--color-warning-icon)",
        error: "var(--color-error-text)",
        "error-icon": "var(--color-error-icon)",
        success: "var(--color-success-text)",
        "success-icon": "var(--color-success-icon)",
        info: "var(--color-info-text)",
        "info-icon": "var(--color-info-icon)",
      },
      borderColor: {
        strong: "var(--color-border-strong)",
        warning: "var(--color-warning-border)",
        error: "var(--color-error-border)",
        success: "var(--color-success-border)",
        info: "var(--color-info-border)",
      },
      keyframes: {
        appear: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
      },
      fontSize: {
        "size-heading-1": "1.5rem",
        "size-heading-2": "1.25rem",
        "size-heading-3": "1.125rem",
        "size-base": "0.875rem",
        "size-small": "0.75rem",
      },
      fontWeight: {
        medium: "500",
        semibold: "500",
      },
      fontFamily: {
        handwritten: ["Caveat", "cursive"],
      },
      screens: {
        vsm: { raw: "(width < 768px) and (orientation: portrait)" },
        vmd: { raw: "(width >= 768px) and (orientation: portrait)" },

        hxs: { raw: "(height < 400px) and (orientation: landscape)" },
        hsm: { raw: "(height >= 400px) and (orientation: landscape)" },
        hmd: { raw: "(height >= 640px) and (orientation: landscape)" },
        hlg: { raw: "(height >= 800px) and (orientation: landscape)" },
        hxl: { raw: "(height > 1080px) and (orientation: landscape)" },

        // Manually generate max-<size> classes due to this bug https://github.com/tailwindlabs/tailwindcss/issues/13022
        "max-xs": {
          raw: `not all and (min-width: 480px)`,
        },
        "max-sm": {
          raw: `not all and (min-width: ${defaultTheme.screens.sm})`,
        },
        "max-md": {
          raw: `not all and (min-width: ${defaultTheme.screens.md})`,
        },
        "max-lg": {
          raw: `not all and (min-width: ${defaultTheme.screens.lg})`,
        },
        "max-xl": {
          raw: `not all and (min-width: ${defaultTheme.screens.xl})`,
        },
        "max-2xl": {
          raw: `not all and (min-width: ${defaultTheme.screens["2xl"]})`,
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    plugin(function ({ addVariant, e }) {
      function addPointerVariant(ruleName, params) {
        addVariant(ruleName, ({ container, separator }) => {
          const pointerRule = postcss.atRule({
            name: "media",
            params,
          });
          pointerRule.append(container.nodes);
          container.append(pointerRule);
          pointerRule.walkRules((rule) => {
            rule.selector = `.${e(
              `${ruleName}${separator}${rule.selector.slice(1)}`,
            )}`;
          });
        });
      }
      addPointerVariant("pointer-coarse", "(pointer: coarse");
      addPointerVariant("pointer-fine", "(pointer: fine");
      addPointerVariant("pointer-none", "(pointer: none");
      addVariant("hover-hover", ({ container, separator }) => {
        const hoverHover = postcss.atRule({
          name: "media",
          params: "(hover: hover)",
        });
        hoverHover.append(container.nodes);
        container.append(hoverHover);
        hoverHover.walkRules((rule) => {
          rule.selector = `.${e(
            `hover-hover${separator}${rule.selector.slice(1)}`,
          )}`;
        });
      });
      addVariant("hover-none", ({ container, separator }) => {
        const hoverNone = postcss.atRule({
          name: "media",
          params: "(hover: none)",
        });
        hoverNone.append(container.nodes);
        container.append(hoverNone);
        hoverNone.walkRules((rule) => {
          rule.selector = `.${e(
            `hover-none${separator}${rule.selector.slice(1)}`,
          )}`;
        });
      });
    }),
  ],
};
