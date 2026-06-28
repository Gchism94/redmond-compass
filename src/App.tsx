import { RouterProvider } from "react-router-dom";
import { DataProvider } from "@/data/DataProvider";
import { SessionProvider } from "@/features/account/session";
import { AuthSheet } from "@/features/account/AuthSheet";
import { Onboarding } from "@/features/account/Onboarding";
import { router } from "@/app/router";

export default function App() {
  return (
    <DataProvider>
      <SessionProvider>
        <RouterProvider router={router} />
        {/* Global, portaled: first-launch onboarding + JIT auth */}
        <Onboarding />
        <AuthSheet />
      </SessionProvider>
    </DataProvider>
  );
}
