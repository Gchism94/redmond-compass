import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteFallback } from "@/components/layout/RouteFallback";
import { GUIDE_SLUGS } from "@/features/guides/registry";
import { appOnly } from "@/lib/siteMode";
import { ErrorPage } from "./ErrorPage";

/**
 * Routes per BUILD-BRIEF §4. Screens are code-split (React.lazy) so each route is
 * its own chunk — the gallery and owner path stay out of the initial bundle, which
 * loads only the shell + Home. A Suspense boundary in AppLayout shows the fallback.
 */
const named = <T extends Record<string, unknown>>(
  factory: () => Promise<T>,
  name: keyof T,
) => lazy(async () => ({ default: (await factory())[name] as ComponentType }));

const HomeScreen = named(() => import("@/features/directory/HomeScreen"), "HomeScreen");
const SearchScreen = named(() => import("@/features/directory/SearchScreen"), "SearchScreen");
const ResultsScreen = named(() => import("@/features/directory/ResultsScreen"), "ResultsScreen");
const BusinessProfileScreen = named(() => import("@/features/directory/BusinessProfileScreen"), "BusinessProfileScreen");
const EventsScreen = named(() => import("@/features/events/EventsScreen"), "EventsScreen");
const EventDetailScreen = named(() => import("@/features/events/EventDetailScreen"), "EventDetailScreen");
const CommunityScreen = named(() => import("@/features/community/CommunityScreen"), "CommunityScreen");
const NewsArticleScreen = named(() => import("@/features/community/NewsArticleScreen"), "NewsArticleScreen");
const ResourcesScreen = named(() => import("@/features/resources/ResourcesScreen"), "ResourcesScreen");
const SavedScreen = named(() => import("@/features/saved/SavedScreen"), "SavedScreen");
const AccountScreen = named(() => import("@/features/account/AccountScreen"), "AccountScreen");
const LoginScreen = named(() => import("@/features/account/LoginScreen"), "LoginScreen");
const ClaimScreen = named(() => import("@/features/owner/ClaimScreen"), "ClaimScreen");
const OwnerDashboard = named(() => import("@/features/owner/OwnerDashboard"), "OwnerDashboard");
const EditListingScreen = named(() => import("@/features/owner/EditListingScreen"), "EditListingScreen");
const PostBulletinScreen = named(() => import("@/features/owner/PostBulletinScreen"), "PostBulletinScreen");
const SubmitEventScreen = named(() => import("@/features/owner/SubmitEventScreen"), "SubmitEventScreen");
const GalleryPage = named(() => import("./GalleryPage"), "GalleryPage");
const NotFoundPage = named(() => import("./pages"), "NotFoundPage");
const GuideScreen = named(() => import("@/features/guides/GuideScreen"), "GuideScreen");
const LandingGate = named(() => import("@/features/landing/LandingScreen"), "LandingGate");

export const router = createBrowserRouter([
  // app-only mode: `/` is the marketing landing page — its own chrome, OUTSIDE the
  // app shells (no tab bar / WebShell / onboarding). Installed apps redirect to /home.
  ...(appOnly
    ? [
        {
          path: "/",
          element: (
            <Suspense fallback={<RouteFallback />}>
              <LandingGate />
            </Suspense>
          ),
          errorElement: <ErrorPage />,
        },
      ]
    : []),
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      ...(appOnly ? [] : [{ path: "/", element: <HomeScreen /> }]),
      // Stable app-home route in both modes: app-only start_url/tabs point here;
      // full-site collapses it back to /.
      { path: "/home", element: appOnly ? <HomeScreen /> : <Navigate to="/" replace /> },
      { path: "/search", element: <SearchScreen /> },
      { path: "/search/results", element: <ResultsScreen /> },
      { path: "/b/:slug", element: <BusinessProfileScreen /> },
      { path: "/events", element: <EventsScreen /> },
      { path: "/events/:id", element: <EventDetailScreen /> },
      { path: "/community", element: <CommunityScreen /> },
      { path: "/news/:slug", element: <NewsArticleScreen /> },
      { path: "/resources", element: <ResourcesScreen /> },
      { path: "/saved", element: <SavedScreen /> },
      { path: "/account", element: <AccountScreen /> },
      { path: "/login", element: <LoginScreen /> },
      // Owner path (B0–B4). Free tier only at MVP; entitlement helper stubbed to Free.
      { path: "/claim", element: <ClaimScreen /> },
      { path: "/manage", element: <OwnerDashboard /> },
      { path: "/manage/edit", element: <EditListingScreen /> },
      { path: "/manage/bulletin/new", element: <PostBulletinScreen /> },
      { path: "/manage/event/new", element: <SubmitEventScreen /> },
      { path: "/gallery", element: <GalleryPage /> },
      // Content pages (Stage 1 Phase 2) — the live site's guides, at their original URLs.
      ...GUIDE_SLUGS.map((slug) => ({ path: `/${slug}`, element: <GuideScreen /> })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
