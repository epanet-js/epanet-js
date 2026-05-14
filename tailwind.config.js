// eslint-disable-next-line
const colors = require("tailwindcss/colors");

module.exports = {
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
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
