/**
 * Redmond Compass — MOCK seed data for the consumer read path.
 * ALL BUSINESSES ARE FICTIONAL — invented for development. No real listings,
 * no real bulletins (explicitly none from the live site). Swap for the real
 * data source (base44 API or shared backend) behind the data-access layer.
 *
 * Every business here is tier "free" (MVP). Geo points are near Redmond, OR.
 * recommendCount is a DEFERRED (fast-follow) positive-only signal — present in
 * the seed so the ResultCard's recommend seam can be exercised, NOT shown at MVP.
 */
import type {
  Business,
  Bulletin,
  EventItem,
  Hours,
  NewsArticle,
  Resource,
  Weekday,
} from "@/lib/types";

/** Compact hours builder: same open/close on the listed days, others closed. */
function hours(
  spec: Partial<Record<Weekday, [string, string]>>,
): Hours {
  const all: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const week = {} as Hours["week"];
  for (const d of all) {
    const v = spec[d];
    week[d] = v ? { open: v[0], close: v[1] } : { open: "", close: "", closed: true };
  }
  return { week };
}

const WEEKDAYS_7_18 = hours({
  tue: ["07:00", "18:00"], wed: ["07:00", "18:00"], thu: ["07:00", "18:00"],
  fri: ["07:00", "18:00"], sat: ["08:00", "15:00"], sun: ["08:00", "15:00"],
});

export const businesses: Business[] = [
  {
    id: "b_juniper", name: "Juniper & Sage Cafe", slug: "juniper-and-sage-cafe",
    category: "Cafe", subcategories: ["Breakfast", "Coffee"],
    description: "Neighborhood cafe serving coffee, breakfast & fresh-baked goods. Dog-friendly patio.",
    address: "512 SW Evergreen Ave, Redmond, OR", geo: { lat: 44.2726, lng: -121.1739 },
    phone: "(541) 555-0142", website: "https://example.com/juniper",
    hours: WEEKDAYS_7_18,
    photos: ["/mock/juniper-1.jpg"], amenityTags: ["Outdoor seating", "Kid-friendly", "Wi-Fi", "Dog-friendly"],
    claimed: true, verified: true, tier: "free", createdAt: "2024-03-01",
    recommendCount: 43,
  },
  {
    id: "b_basalt", name: "Basalt Coffee Roasters", slug: "basalt-coffee-roasters",
    category: "Coffee", subcategories: ["Roastery"],
    description: "Small-batch roaster and tasting bar in the heart of downtown.",
    address: "210 SW 6th St, Redmond, OR", geo: { lat: 44.2741, lng: -121.1722 },
    phone: "(541) 555-0119",
    hours: hours({
      mon: ["06:30", "17:00"], tue: ["06:30", "17:00"], wed: ["06:30", "17:00"],
      thu: ["06:30", "17:00"], fri: ["06:30", "17:00"], sat: ["07:00", "16:00"], sun: ["07:00", "14:00"],
    }),
    photos: ["/mock/basalt-1.jpg"], amenityTags: ["Wi-Fi", "Outdoor seating", "Takeout"],
    claimed: true, verified: true, tier: "free", createdAt: "2024-05-10",
    recommendCount: 67,
  },
  {
    id: "b_cascade", name: "Cascade Hardware", slug: "cascade-hardware",
    category: "Hardware", subcategories: ["Home", "Garden"],
    description: "Locally owned hardware store — tools, paint, garden, and friendly advice.",
    address: "1024 NW Cedar Ave, Redmond, OR", geo: { lat: 44.2789, lng: -121.1765 },
    phone: "(541) 555-0188",
    hours: hours({
      mon: ["07:30", "19:00"], tue: ["07:30", "19:00"], wed: ["07:30", "19:00"], thu: ["07:30", "19:00"],
      fri: ["07:30", "19:00"], sat: ["08:00", "18:00"], sun: ["09:00", "16:00"],
    }),
    photos: [], amenityTags: ["Parking", "Wheelchair accessible"],
    claimed: true, verified: false, tier: "free", createdAt: "2023-11-20",
    recommendCount: 29,
  },
  {
    id: "b_highdesert", name: "High Desert Bakery", slug: "high-desert-bakery",
    category: "Bakery", subcategories: ["Cafe"],
    description: "Sourdough, pastries, and seasonal pies baked fresh daily.",
    address: "78 SW Deschutes Ave, Redmond, OR", geo: { lat: 44.2710, lng: -121.1751 },
    phone: "(541) 555-0173",
    hours: hours({
      tue: ["07:00", "16:00"], wed: ["07:00", "16:00"], thu: ["07:00", "16:00"],
      fri: ["07:00", "16:00"], sat: ["07:00", "14:00"], sun: ["08:00", "13:00"],
    }),
    photos: ["/mock/bakery-1.jpg"], amenityTags: ["Gluten-free", "Kid-friendly", "Vegan options"],
    claimed: true, verified: true, tier: "free", createdAt: "2024-01-15",
    recommendCount: 31,
  },
  {
    id: "b_dailygrind", name: "The Daily Grind", slug: "the-daily-grind",
    category: "Cafe", subcategories: ["Bakery", "Coffee"],
    description: "Cozy corner cafe with espresso, scones, and a quiet back room for working.",
    address: "335 SW Forest Ave, Redmond, OR", geo: { lat: 44.2698, lng: -121.1718 },
    phone: "(541) 555-0204",
    hours: hours({
      mon: ["06:00", "19:00"], tue: ["06:00", "19:00"], wed: ["06:00", "19:00"], thu: ["06:00", "19:00"],
      fri: ["06:00", "20:00"], sat: ["07:00", "20:00"], sun: ["07:00", "17:00"],
    }),
    photos: [], amenityTags: ["Wi-Fi", "Outdoor seating", "Vegan options"],
    claimed: true, verified: false, tier: "free", createdAt: "2025-02-02",
    recommendCount: 22,
  },
  {
    id: "b_smithrock", name: "Smith Rock Outfitters", slug: "smith-rock-outfitters",
    category: "Outdoors", subcategories: ["Recreation", "Retail"],
    description: "Climbing, hiking & camping gear — rentals, guides, and trail beta from locals.",
    address: "640 NW 5th St, Redmond, OR", geo: { lat: 44.2767, lng: -121.1744 },
    phone: "(541) 555-0231", website: "https://example.com/smithrock",
    hours: hours({
      mon: ["09:00", "18:00"], tue: ["09:00", "18:00"], wed: ["09:00", "18:00"], thu: ["09:00", "18:00"],
      fri: ["09:00", "19:00"], sat: ["08:00", "19:00"], sun: ["08:00", "17:00"],
    }),
    photos: ["/mock/smithrock-1.jpg"], amenityTags: ["Parking", "Wheelchair accessible", "Dog-friendly"],
    claimed: true, verified: true, tier: "free", createdAt: "2023-08-12",
    recommendCount: 58,
  },
  {
    id: "b_riverbend", name: "Riverbend Family Dental", slug: "riverbend-family-dental",
    category: "Health", subcategories: ["Medical", "Wellness"],
    description: "Gentle, modern family dentistry. New patients welcome.",
    address: "1450 NW Canal Blvd, Redmond, OR", geo: { lat: 44.2831, lng: -121.1802 },
    phone: "(541) 555-0266", website: "https://example.com/riverbend",
    hours: hours({
      mon: ["08:00", "17:00"], tue: ["08:00", "17:00"], wed: ["08:00", "17:00"], thu: ["08:00", "17:00"],
      fri: ["08:00", "14:00"],
    }),
    photos: [], amenityTags: ["Parking", "Wheelchair accessible"],
    claimed: true, verified: true, tier: "free", createdAt: "2022-06-01",
    recommendCount: 37,
  },
  {
    id: "b_mountainview", name: "Mountain View Auto Repair", slug: "mountain-view-auto-repair",
    category: "Auto", subcategories: ["Repair"],
    description: "Honest, full-service auto repair and maintenance. ASE-certified techs.",
    address: "2210 S Hwy 97, Redmond, OR", geo: { lat: 44.2562, lng: -121.1690 },
    phone: "(541) 555-0299",
    hours: hours({
      mon: ["07:30", "17:30"], tue: ["07:30", "17:30"], wed: ["07:30", "17:30"], thu: ["07:30", "17:30"],
      fri: ["07:30", "17:00"],
    }),
    photos: [], amenityTags: ["Parking", "Wheelchair accessible"],
    claimed: false, verified: false, tier: "free", createdAt: "2024-09-18",
    recommendCount: 14,
  },
  {
    id: "b_threesisters", name: "Three Sisters Provisions", slug: "three-sisters-provisions",
    category: "Grocery", subcategories: ["Retail"],
    description: "Independent grocer with local produce, bulk goods, and regional makers.",
    address: "418 SW Glacier Ave, Redmond, OR", geo: { lat: 44.2705, lng: -121.1772 },
    phone: "(541) 555-0312",
    hours: hours({
      mon: ["08:00", "20:00"], tue: ["08:00", "20:00"], wed: ["08:00", "20:00"], thu: ["08:00", "20:00"],
      fri: ["08:00", "21:00"], sat: ["08:00", "21:00"], sun: ["09:00", "19:00"],
    }),
    photos: ["/mock/provisions-1.jpg"], amenityTags: ["Parking", "Vegan options", "Gluten-free", "Wheelchair accessible"],
    claimed: true, verified: true, tier: "free", createdAt: "2023-04-22",
    recommendCount: 49,
  },
  {
    id: "b_canyon", name: "Canyon Bloom Florist", slug: "canyon-bloom-florist",
    category: "Retail", subcategories: ["Boutique"],
    description: "Seasonal arrangements and house plants, designed in-shop. Same-day delivery.",
    address: "127 SW 7th St, Redmond, OR", geo: { lat: 44.2733, lng: -121.1709 },
    phone: "(541) 555-0345", website: "https://example.com/canyonbloom",
    hours: hours({
      mon: ["09:00", "17:00"], tue: ["09:00", "17:00"], wed: ["09:00", "17:00"], thu: ["09:00", "17:00"],
      fri: ["09:00", "18:00"], sat: ["10:00", "16:00"],
    }),
    photos: ["/mock/florist-1.jpg"], amenityTags: ["Wheelchair accessible", "Takeout"],
    claimed: true, verified: false, tier: "free", createdAt: "2025-05-01",
    recommendCount: 8,
  },
];

export const bulletins: Bulletin[] = [
  { id: "bl_1", businessId: "b_juniper", body: "Fresh sourdough — Saturdays only, while it lasts.",
    status: "live", createdAt: "2026-06-25T08:00:00" },
  { id: "bl_2", businessId: "b_basalt", body: "New fall roast just dropped. Come try a free pour-over sample.",
    status: "live", createdAt: "2026-06-23T09:30:00" },
  { id: "bl_3", businessId: "b_highdesert", body: "Strawberry-rhubarb pies are back this weekend. Pre-order by Friday.",
    status: "live", createdAt: "2026-06-24T10:00:00" },
  { id: "bl_4", businessId: "b_smithrock", body: "Free climbing-shoe demo day Saturday 10–2. All skill levels welcome.",
    status: "live", createdAt: "2026-06-22T12:00:00" },
  { id: "bl_5", businessId: "b_threesisters", body: "Local cherries just arrived — first of the season.",
    status: "live", createdAt: "2026-06-26T07:30:00" },
];

export const events: EventItem[] = [
  // NOTE: July 2026 — Jul 10 & 17 are Fridays; Jul 11 is a Saturday; Jul 26 a Sunday.
  // Dates chosen so the computed weekday matches each event's intent.
  { id: "e_1", businessId: "b_juniper", title: "Live acoustic night",
    description: "An intimate evening of acoustic sets on the patio.",
    startAt: "2026-07-10T19:00:00", venueName: "Juniper & Sage Cafe",
    address: "512 SW Evergreen Ave, Redmond, OR", geo: { lat: 44.2726, lng: -121.1739 },
    status: "upcoming", category: "Music" },
  { id: "e_2", title: "Saturday Farmers Market",
    description: "Local growers, makers, and food carts every Saturday morning.",
    startAt: "2026-07-11T09:00:00", venueName: "Centennial Park",
    address: "Centennial Park, Redmond, OR", geo: { lat: 44.2740, lng: -121.1730 },
    status: "upcoming", category: "Community", tags: ["Free", "Family"] },
  { id: "e_3", title: "Kids' craft hour",
    description: "Drop-in crafts for ages 4–10. Materials provided.",
    startAt: "2026-07-11T11:00:00", venueName: "Redmond Public Library",
    address: "827 SW Deschutes Ave, Redmond, OR", geo: { lat: 44.2700, lng: -121.1758 },
    status: "upcoming", category: "Family", tags: ["Free", "Kids"] },
  { id: "e_4", title: "High Desert Brewfest",
    description: "Regional breweries, live music, and food carts downtown.",
    startAt: "2026-07-17T16:00:00", venueName: "Downtown Redmond",
    address: "SW 6th St, Redmond, OR", geo: { lat: 44.2738, lng: -121.1725 },
    status: "upcoming", category: "Festival", tags: ["21+"] },
  { id: "e_5", businessId: "b_smithrock", title: "Trail cleanup & potluck",
    description: "Help tidy the river trail, then share a meal.",
    startAt: "2026-07-26T09:00:00", venueName: "Dry Canyon Trailhead",
    address: "NW Quartz Ave, Redmond, OR", geo: { lat: 44.2810, lng: -121.1800 },
    status: "upcoming", category: "Outdoors", tags: ["Free", "Volunteer"] },
];

export const news: NewsArticle[] = [
  { id: "n_1", title: "Downtown plaza project breaks ground", slug: "downtown-plaza-breaks-ground",
    excerpt: "Construction begins on the long-planned civic plaza this week.",
    body: "Construction crews broke ground Monday on Redmond's downtown civic plaza, a project years in the making. The plaza will add gathering space, public art, and a small stage for community events. City officials expect completion by next summer.",
    source: "Redmond Spokesman", author: "J. Ramirez", publishedAt: "2026-06-26T14:00:00" },
  { id: "n_2", title: "City council approves new bike lanes", slug: "council-approves-bike-lanes",
    excerpt: "Protected lanes are coming to two major corridors next year.",
    body: "The Redmond City Council voted 5–2 Tuesday to fund protected bike lanes along Canal Boulevard and 6th Street, part of a broader active-transportation plan.",
    source: "Central Oregon Daily", publishedAt: "2026-06-24T18:30:00" },
  { id: "n_3", title: "Summer concert series returns to the park", slug: "summer-concert-series-returns",
    excerpt: "Free Thursday-evening concerts run through August.",
    body: "The beloved summer concert series is back at Sam Johnson Park, with free performances every Thursday evening through August. Bring a blanket.",
    source: "Redmond Spokesman", publishedAt: "2026-06-20T09:00:00" },
];

export const resources: Resource[] = [
  { id: "r_1", name: "Redmond Police (non-emergency)", category: "emergency",
    description: "Report & general inquiries", phone: "(541) 555-0000" },
  { id: "r_2", name: "Redmond Fire & Rescue", category: "emergency",
    description: "Burn permits, safety info", phone: "(541) 555-0011" },
  { id: "r_3", name: "City of Redmond", category: "government",
    description: "Permits, utilities, council", url: "https://example.com/city",
    address: "411 SW 9th St, Redmond, OR" },
  { id: "r_4", name: "DMV — Redmond", category: "government",
    description: "Licenses & registration", url: "https://example.com/dmv",
    address: "2410 SW 17th Pl, Redmond, OR" },
  { id: "r_5", name: "Redmond Public Library", category: "community",
    description: "Hours, programs, library cards", url: "https://example.com/library",
    address: "827 SW Deschutes Ave, Redmond, OR" },
  { id: "r_6", name: "Pacific Power (outages)", category: "utilities",
    description: "Report outages & start/stop service", phone: "(541) 555-0044",
    url: "https://example.com/power" },
];
