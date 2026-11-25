/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rail: {
          navy: '#0A2540',
          royal: '#0052CC',
          primary: '#0B6EFD',
          sky: '#EBF4FF',
          accent: '#FF9933',
          green: '#138808',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 35px -5px rgba(10, 37, 64, 0.12), 0 4px 12px -2px rgba(11, 110, 253, 0.08)',
      },
    },
  },
  plugins: [],
};
