import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { GalleryPage } from "./GalleryPage";
import { HomeScreen } from "@/features/directory/HomeScreen";
import { SearchScreen } from "@/features/directory/SearchScreen";
import { ResultsScreen } from "@/features/directory/ResultsScreen";
import { BusinessProfileScreen } from "@/features/directory/BusinessProfileScreen";
import { EventsScreen } from "@/features/events/EventsScreen";
import { EventDetailScreen } from "@/features/events/EventDetailScreen";
import { CommunityScreen } from "@/features/community/CommunityScreen";
import { NewsArticleScreen } from "@/features/community/NewsArticleScreen";
import { ResourcesScreen } from "@/features/resources/ResourcesScreen";
import { SavedScreen } from "@/features/saved/SavedScreen";
import { AccountScreen } from "@/features/account/AccountScreen";
import { LoginScreen } from "@/features/account/LoginScreen";
import { ClaimScreen } from "@/features/owner/ClaimScreen";
import { OwnerDashboard } from "@/features/owner/OwnerDashboard";
import { EditListingScreen } from "@/features/owner/EditListingScreen";
import { PostBulletinScreen } from "@/features/owner/PostBulletinScreen";
import { SubmitEventScreen } from "@/features/owner/SubmitEventScreen";
import { NotFoundPage } from "./pages";

/**
 * Routes per BUILD-BRIEF §4. Consumer read path + JIT auth/personalization
 * (steps 1–6) are live on mock data. Owner routes (/claim, /manage…) arrive in
 * step 7. /gallery is the dev component gallery.
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomeScreen /> },
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
