const defaultTheme = require("tailwindcss/defaultTheme");
// eslint-disable-next-line
const colors = require("tailwindcss/colors");
// eslint-disable-next-line
const plugin = require("tailwindcss/plugin");
// eslint-disable-next-line
const postcss = require("postcss");

module.exports = {
  jit: "enable",
  content: ["./{components,src,pages}/**/*.{js,ts,jsx,tsx}"],
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
      keyframes: {
        appear: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
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
