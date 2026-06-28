import type { Config } from "tailwindcss";

/**
 * Redmond Compass — Tailwind theme, wired to design-tokens.css.
 * Tokens are HSL channels (shadcn convention); reference them with hsl(var(--token)).
 * Brand parity with the live site: cream + navy, amber primary, terracotta accent,
 * pine-green positive. Playfair (headings) + DM Sans (everything else).
 *
 * Requires design-tokens.css imported in your global stylesheet so :root vars exist.
 */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { sm: "480px", md: "768px", lg: "1024px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))", // pine green — also the "positive / open / link" role
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" }, // amber CTAs
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" }, // terracotta
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        // Semantic alias so components can say text-positive / bg-positive instead of ring.
        // pine green is the dominant interactive accent in the finished hi-fi.
        positive: {
          DEFAULT: "hsl(var(--ring))", // #2E6049
          strong: "#357A5E",           // hover / brighter
          tint: "#E7EFE9",             // selected / positive backgrounds
          line: "#C4D9CC",             // green borders
        },
        // Hi-fi-derived shades (see design-tokens.css "Extended palette"):
        "primary-hover": "#A35408",     // amber hover/active
        "accent-tint": "#E6D7BF",       // warm gold tint bg
        "navy-soft": "#11385F",         // secondary navy / pressed
        surface: { raised: "#FCFAF7", sunken: "#EBE6E0" },
        "border-strong": "#DDD6CC",
        ink: { secondary: "#455852", faint: "#9A958B" }, // secondary / faint text
        danger: "#B23A3A",              // confirm: hi-fi used a warm red error family
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        // Use `font-heading` ONLY for titles/section heads/hero. Everything else = default sans.
        heading: ["Playfair Display", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",                    // 12px
        md: "calc(var(--radius) - 4px)",        // 8px
        sm: "calc(var(--radius) - 6px)",        // 6px
        pill: "999px",
      },
      boxShadow: {
        card: "0 6px 16px -10px rgba(8,41,84,.22)",
        sticky: "0 4px 12px -8px rgba(8,41,84,.18)",
        modal: "0 18px 44px -20px rgba(8,41,84,.40)",
      },
      maxWidth: { content: "480px" }, // mobile content column cap
    },
  },
  plugins: [require("tailwindcss-animate")], // for shadcn animations; optional
} satisfies Config;
