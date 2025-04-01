import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // './src/pages/**/*.{js,ts,jsx,tsx,mdx}', // Uncomment if using Pages Router
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}', // Include App Router directory
  ],
  theme: {
    extend: {
      // Add any theme customizations here later (e.g., custom colors, fonts)
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
   darkMode: 'media', // Or 'class' if you prefer manual toggling
};
export default config;