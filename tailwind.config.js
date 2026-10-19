/** @type {import('tailwindcss').Config} */
// Paleta tirada do logo CB& (azul-marinho do fundo e dourado do "&") e do
// diagnostico do Lucas (#0F2A4A / #B39A6B), para o sistema conversar com o
// Instagram e o site do escritorio.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marinho: {
          950: '#071629',
          900: '#0B1F38',
          800: '#0F2A4A',
          700: '#163A63',
          600: '#22507F',
          500: '#3A6A9C',
          100: '#E3EAF3',
          50: '#F1F5FA',
        },
        ouro: {
          700: '#8A7246',
          600: '#9E855A',
          500: '#B39A6B',
          400: '#C6B08A',
          300: '#D8C7A6',
          100: '#F2EBDD',
          50: '#FAF6EE',
        },
        papel: '#F7F5F0',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        cartao: '0 1px 2px rgba(11,31,56,.03), 0 14px 34px rgba(11,31,56,.05)',
        flutuante: '0 18px 42px rgba(11,31,56,.22)',
      },
    },
  },
  plugins: [],
}
