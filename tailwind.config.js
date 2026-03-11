/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ray-bg': 'rgba(23, 23, 23, 0.8)',
        'ray-border': 'rgba(255, 255, 255, 0.1)',
        'ray-hover': 'rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}
