/**
 * App — routes (BUILD-BRIEF §4) wrapped in the AppLayout shell.
 * Screens are placeholders for now; replace each element as you build it.
 * Active tab is derived from the path; detail/owner/auth routes highlight nothing.
 */
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AppLayout, type TabKey } from "./components";
import { ScreenPlaceholder } from "./app/ScreenPlaceholder";
import { Gallery } from "./app/Gallery";

function activeTabFor(pathname: string): TabKey | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/account")) return "account";
  return null; // /b/:slug, /manage*, /claim, auth → no active tab
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <AppLayout active={activeTabFor(pathname)}>
      <Routes>
        {/* Consumer */}
        <Route path="/" element={<ScreenPlaceholder title="Home" note="Personalized feed · cold-start fallback (S2)" />} />
        <Route path="/search" element={<ScreenPlaceholder title="Search" note="Explore (S3)" />} />
        <Route path="/search/results" element={<ScreenPlaceholder title="Results" note="List · filters · map later (S4)" />} />
        <Route path="/b/:slug" element={<ScreenPlaceholder title="Business Profile" note="The destination (S5)" />} />
        <Route path="/events" element={<ScreenPlaceholder title="Events" note="Time-grouped (S6)" />} />
        <Route path="/community" element={<ScreenPlaceholder title="Community" note="News + bulletins" />} />
        <Route path="/resources" element={<ScreenPlaceholder title="Resources" note="Categorized civic list" />} />
        <Route path="/saved" element={<ScreenPlaceholder title="Saved" note="Businesses · Following · Events (S7)" />} />
        <Route path="/account" element={<ScreenPlaceholder title="Account" note="Prefs · notifications · mode switch (S8)" />} />

        {/* Owner — build from wireframes (B0/B1/B4) */}
        <Route path="/claim" element={<ScreenPlaceholder title="Claim your listing" note="B0 — free" />} />
        <Route path="/manage" element={<ScreenPlaceholder title="Owner Dashboard" note="B1 — build from wireframe" />} />
        <Route path="/manage/edit" element={<ScreenPlaceholder title="Edit Listing" note="B4 — build from wireframe" />} />
        <Route path="/manage/bulletin/new" element={<ScreenPlaceholder title="Post Bulletin" note="B2" />} />
        <Route path="/manage/event/new" element={<ScreenPlaceholder title="Submit Event" note="B3" />} />

        {/* Auth — just-in-time, never a gate */}
        <Route path="/login" element={<ScreenPlaceholder title="Sign in" note="JIT — only at save/follow/post" />} />

        {/* Dev */}
        <Route path="/_gallery" element={<Gallery />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
