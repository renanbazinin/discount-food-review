/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#0a1220',
        cream: '#f7f3ec',
        accent: '#ff5a3c'
      }
    }
  },
  plugins: []
};
