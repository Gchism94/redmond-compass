import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";

/**
 * Temporary scaffold for consumer screens. Real screens land in §12 step 5
 * (after the data-layer interface is confirmed). Lets the shell + nav be
 * navigated and reviewed at the checkpoint.
 */
export function PagePlaceholder({
  title,
  note,
  back,
}: {
  title: string;
  note?: string;
  back?: boolean;
}) {
  return (
    <>
      <ScreenHeader title={title} back={back} />
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-positive">
          <Compass size={26} />
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">
          {note ?? "This screen is wired into the shell. Its content is built in step 5 (consumer read path), pending data-layer sign-off."}
        </p>
        <Link to="/gallery" className="mt-6 text-sm font-semibold text-positive hover:underline">
          View the component gallery →
        </Link>
      </div>
    </>
  );
}
