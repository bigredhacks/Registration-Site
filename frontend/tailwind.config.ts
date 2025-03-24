import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        "off-white": "#FFF8F0",
        "brown-transparent": "#D6D3CF",
        "brown-light": "#907960",
        "brown-medium": "#C0AB95",
        "brown-dark": "#775E43",
        "red-light": "#E46966",
        "red-light-medium": "#E34C49",
        "red-medium": "#FE1736",
      },
    },
  },
  plugins: [],
};
export default config;
