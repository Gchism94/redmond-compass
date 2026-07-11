import { RouterProvider } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { AuthSheet } from "@/features/account/AuthSheet";
import { Onboarding } from "@/features/account/Onboarding";
import { router } from "@/app/router";

export default function App() {
  return (
    <I18nProvider>
      <DataProvider>
        <SessionProvider>
          <RouterProvider router={router} />
          {/* Global, portaled: first-launch onboarding + JIT auth */}
          <Onboarding />
          <AuthSheet />
        </SessionProvider>
      </DataProvider>
    </I18nProvider>
  );
}
