/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta minimalista, no negro puro (#000) para evitar el look
        // "plantilla" y dar algo de profundidad tipo VSCO.
        ink: "#0B0B0C",
        charcoal: "#141416",
        line: "#232326",
        bone: "#EDEBE6",
        mute: "#8A8A8E",
        accent: "#C9A876",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.35em",
      },
    },
  },
  plugins: [],
};
