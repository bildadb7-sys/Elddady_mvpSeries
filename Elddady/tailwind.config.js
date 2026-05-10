/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: { 
        lg: "var(--radius)", 
        md: "calc(var(--radius) - 2px)", 
        sm: "calc(var(--radius) - 4px)" 
      },
      colors: {
        background: "var(--background)", 
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        border: "var(--border)", 
        input: "var(--input)", 
        ring: "var(--ring)",
      },
      fontFamily: { 
        sans: ["Inter", "sans-serif"], 
        logo: ["Grand Hotel", "cursive"] 
      }
    }
  },
  plugins: [],
}
