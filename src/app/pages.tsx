/**
 * Catch-all 404. All other routes are real screens (see router.tsx).
 */
import { PagePlaceholder } from "./PagePlaceholder";

export const NotFoundPage = () => (
  <PagePlaceholder title="Not found" note="That page doesn't exist. Use the tabs below to get back on track." />
);
