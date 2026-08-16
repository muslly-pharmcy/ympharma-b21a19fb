/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#005D4F',
          50: '#E6F5F3',
          100: '#CCEBE7',
          200: '#99D7CF',
          300: '#66C3B7',
          400: '#33AF9F',
          500: '#005D4F',
          600: '#004A3F',
          700: '#00382F',
          800: '#002520',
          900: '#001310',
        },
        secondary: {
          DEFAULT: '#0F766E',
          50: '#E6F7F6',
          100: '#CCEFED',
          200: '#99DFDA',
          300: '#66CFC8',
          400: '#33BFB5',
          500: '#0F766E',
          600: '#0C5E58',
          700: '#094742',
          800: '#062F2C',
          900: '#031816',
        },
        gold: {
          DEFAULT: '#C9A227',
          50: '#FBF5E3',
          100: '#F7EBC7',
          200: '#EFD78F',
          300: '#E7C357',
          400: '#D4AF37',
          500: '#C9A227',
          600: '#A1821F',
          700: '#796117',
          800: '#51410F',
          900: '#282008',
        },
        background: '#F4F7F6',
        surface: '#FFFFFF',
        'surface-dark': '#1A1A2E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Tahoma', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(150px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(150px) rotate(-360deg)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #C9A227, 0 0 10px #C9A227' },
          '100%': { boxShadow: '0 0 20px #C9A227, 0 0 40px #C9A227' },
        },
      },
    },
  },
  plugins: [],
}
