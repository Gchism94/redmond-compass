import {
  UtensilsCrossed,
  Briefcase,
  ShoppingBag,
  HeartPulse,
  Home,
  Car,
  Mountain,
  Grid3x3,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Briefcase,
  ShoppingBag,
  HeartPulse,
  Home,
  Car,
  Mountain,
  Grid3x3,
};

/** Resolve a taxonomy icon name (taxonomy.ts) to a lucide icon. */
export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = MAP[name] ?? Grid3x3;
  return <Icon size={size} aria-hidden />;
}
