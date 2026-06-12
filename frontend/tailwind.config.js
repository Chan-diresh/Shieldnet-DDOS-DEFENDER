/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "#030711",
        surface:  "#080e1c",
        surface2: "#0c1525",
        surface3: "#111e33",
        border:   "#172438",
        cyan:     "#00c8f0",
        green:    "#00e87a",
        red:      "#ff2d55",
        orange:   "#ff8a00",
        yellow:   "#ffc107",
        textDim:  "#4a6078",
        textBright:"#e0eeff",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Syne", "sans-serif"],
      },
    },
  },
  plugins: [],
};
