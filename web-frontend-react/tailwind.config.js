/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 定义全局主色调体系，方便一键换肤
        // 这里采用天空蓝(sky)与青绿(teal)的清新教育系配色
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9', // 主题色
          600: '#0284c7', // hover等加深色
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        secondary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6', // 辅助色/强调色
          600: '#0d9488',
        },
        accent: {
          500: '#10b981', // 成功、正确等高亮颜色
        }
      }
    },
  },
  plugins: [],
}