import { RouterProvider } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { router } from "@/app/router";

export default function App() {
  return (
    <I18nProvider>
      <DataProvider>
        <SessionProvider>
          {/* Onboarding + AuthSheet render inside AppLayout (app routes only) —
              the app-only landing page must stay free of app chrome. */}
          <RouterProvider router={router} />
        </SessionProvider>
      </DataProvider>
    </I18nProvider>
  );
}
