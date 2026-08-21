/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f1115',
        surface: '#1c1f26',
        primary: '#3b82f6',
      }
    },
  },
  plugins: [],
}
