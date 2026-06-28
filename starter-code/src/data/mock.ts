/**
 * Redmond Compass — MOCK seed data for the consumer read path.
 * ALL BUSINESSES ARE FICTIONAL — invented for development. No real listings,
 * no real bulletins (explicitly none from the live site). Swap for the real
 * data source (base44 API or shared backend) behind the data-access layer.
 *
 * Every business here is tier "free" (MVP). Geo points are near Redmond, OR.
 */
import type { Business, Bulletin, EventItem, NewsArticle, Resource } from "../lib/types";

export const businesses: Business[] = [
  {
    id: "b_juniper", name: "Juniper & Sage Cafe", slug: "juniper-and-sage-cafe",
    category: "Cafe", subcategories: ["Breakfast", "Coffee"],
    description: "Neighborhood cafe serving coffee, breakfast & fresh-baked goods. Dog-friendly patio.",
    address: "512 SW Evergreen Ave, Redmond, OR", geo: { lat: 44.2726, lng: -121.1739 },
    phone: "(541) 555-0142", website: "https://example.com/juniper",
    hours: { week: {
      mon: { open: "", close: "", closed: true }, tue: { open: "07:00", close: "18:00" },
      wed: { open: "07:00", close: "18:00" }, thu: { open: "07:00", close: "18:00" },
      fri: { open: "07:00", close: "18:00" }, sat: { open: "08:00", close: "15:00" },
      sun: { open: "08:00", close: "15:00" } } },
    photos: ["/mock/juniper-1.jpg"], amenityTags: ["Outdoor seating", "Kid-friendly", "Wi-Fi"],
    claimed: true, verified: true, tier: "free", createdAt: "2024-03-01",
  },
  {
    id: "b_basalt", name: "Basalt Coffee Roasters", slug: "basalt-coffee-roasters",
    category: "Coffee", subcategories: ["Roastery"],
    description: "Small-batch roaster and tasting bar in the heart of downtown.",
    address: "210 SW 6th St, Redmond, OR", geo: { lat: 44.2741, lng: -121.1722 },
    phone: "(541) 555-0119", photos: ["/mock/basalt-1.jpg"],
    amenityTags: ["Wi-Fi", "Outdoor seating"], claimed: true, verified: true,
    tier: "free", createdAt: "2024-05-10",
  },
  {
    id: "b_cascade", name: "Cascade Hardware", slug: "cascade-hardware",
    category: "Retail", subcategories: ["Hardware", "Home"],
    description: "Locally owned hardware store — tools, paint, garden, and friendly advice.",
    address: "1024 NW Cedar Ave, Redmond, OR", geo: { lat: 44.2789, lng: -121.1765 },
    phone: "(541) 555-0188", photos: [], amenityTags: ["Parking", "Wheelchair accessible"],
    claimed: true, verified: false, tier: "free", createdAt: "2023-11-20",
  },
  {
    id: "b_highdesert", name: "High Desert Bakery", slug: "high-desert-bakery",
    category: "Bakery", subcategories: ["Cafe"],
    description: "Sourdough, pastries, and seasonal pies baked fresh daily.",
    address: "78 SW Deschutes Ave, Redmond, OR", geo: { lat: 44.2710, lng: -121.1751 },
    phone: "(541) 555-0173", photos: ["/mock/bakery-1.jpg"],
    amenityTags: ["Gluten-free", "Kid-friendly"], claimed: true, verified: true,
    tier: "free", createdAt: "2024-01-15",
  },
];

export const bulletins: Bulletin[] = [
  { id: "bl_1", businessId: "b_juniper", body: "Fresh sourdough — Saturdays only, while it lasts.",
    status: "live", createdAt: "2026-06-25" },
  { id: "bl_2", businessId: "b_basalt", body: "New fall roast just dropped. Come try a free pour-over sample.",
    status: "live", createdAt: "2026-06-23" },
];

export const events: EventItem[] = [
  { id: "e_1", businessId: "b_juniper", title: "Live acoustic night",
    startAt: "2026-07-12T19:00:00", venueName: "Juniper & Sage Cafe",
    address: "512 SW Evergreen Ave, Redmond, OR", status: "upcoming", category: "Music" },
  { id: "e_2", title: "Saturday Farmers Market", startAt: "2026-07-13T09:00:00",
    venueName: "Centennial Park", address: "Centennial Park, Redmond, OR",
    status: "upcoming", category: "Community" },
];

export const news: NewsArticle[] = [
  { id: "n_1", title: "Downtown plaza project breaks ground", slug: "downtown-plaza-breaks-ground",
    excerpt: "Construction begins on the long-planned civic plaza this week.",
    body: "…", source: "Redmond Spokesman", publishedAt: "2026-06-26" },
];

export const resources: Resource[] = [
  { id: "r_1", name: "Redmond Police (non-emergency)", category: "emergency",
    description: "Report & general inquiries", phone: "(541) 555-0000" },
  { id: "r_2", name: "City of Redmond", category: "government",
    description: "Permits, utilities, council", url: "https://example.com/city" },
  { id: "r_3", name: "Public Library", category: "community",
    description: "Hours, programs, library cards", url: "https://example.com/library" },
];
