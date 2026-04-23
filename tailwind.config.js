/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#07c160',
        'primary-dark': '#06ad58',
        danger: '#f56c6c',
        accent: '#2563eb'
      },
      maxWidth: {
        mobile: '480px'
      }
    }
  },
  plugins: []
};
