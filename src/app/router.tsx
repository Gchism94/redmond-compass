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
const ManageBulletinsScreen = named(() => import("@/features/owner/ManageBulletinsScreen"), "ManageBulletinsScreen");
const BulletinEditorScreen = named(() => import("@/features/owner/ManageBulletinsScreen"), "BulletinEditorScreen");
const ManageEventsScreen = named(() => import("@/features/owner/ManageEventsScreen"), "ManageEventsScreen");
const EventEditorScreen = named(() => import("@/features/owner/ManageEventsScreen"), "EventEditorScreen");
const ManageClassesScreen = named(() => import("@/features/owner/ManageClassesScreen"), "ManageClassesScreen");
const ClassEditorScreen = named(() => import("@/features/owner/ManageClassesScreen"), "ClassEditorScreen");
const NotFoundPage = named(() => import("./pages"), "NotFoundPage");
const GuideScreen = named(() => import("@/features/guides/GuideScreen"), "GuideScreen");
const LandingGate = named(() => import("@/features/landing/LandingScreen"), "LandingGate");

/** DEV-only: resolved lazily so the gallery chunk never enters a production build. */
const GalleryDevRoute = import.meta.env.DEV
  ? named(() => import("./GalleryPage"), "GalleryPage")
  : () => null;

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
      { path: "/manage/bulletins", element: <ManageBulletinsScreen /> },
      { path: "/manage/bulletins/:id/edit", element: <BulletinEditorScreen /> },
      { path: "/manage/events", element: <ManageEventsScreen /> },
      { path: "/manage/events/:id/edit", element: <EventEditorScreen /> },
      { path: "/manage/classes", element: <ManageClassesScreen /> },
      { path: "/manage/classes/new", element: <ClassEditorScreen /> },
      { path: "/manage/classes/:id/edit", element: <ClassEditorScreen /> },
      // Component gallery: a DEV-only surface, never a reachable route in production (#8).
      // The lazy() lives INSIDE this branch on purpose — declared at module scope it was a
      // top-level call Rollup couldn't prove pure, so the 14.7 KB gallery chunk shipped to
      // every production build even though the route was already gated. Inside the folded
      // branch the dynamic import is dead code and the chunk is never emitted.
      ...(import.meta.env.DEV
        ? [{ path: "/gallery", element: <GalleryDevRoute /> }]
        : []),
      // Content pages (Stage 1 Phase 2) — the live site's guides, at their original URLs.
      ...GUIDE_SLUGS.map((slug) => ({ path: `/${slug}`, element: <GuideScreen /> })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
