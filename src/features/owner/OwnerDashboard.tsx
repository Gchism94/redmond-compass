import { Link, Navigate, useNavigate } from "react-router-dom";
import { Repeat, Megaphone, CalendarPlus, Pencil, ArrowRight } from "lucide-react";
import { Thumb, VerifiedBadge, StatusBadge, CompletenessMeter, Card, Skeleton } from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { useBulletinCount } from "@/data/queries";
import { useSession } from "@/features/account/session";
import { listingCompleteness } from "@/lib/completeness";
import { LIMITS } from "@/lib/entitlements";

/**
 * Owner Dashboard (B1) — light "manage my listing" hub. MVP is FREE only:
 * header, completeness, quick actions. No tiers/paywall/modules (§3) — Member
 * analytics/demand and Pro tools are designed-ahead and gated by the entitlement
 * helper (can(tier, …)); they simply don't render for free.
 */
export function OwnerDashboard() {
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading } = useOwnerBusiness();
  const { setOwnerBusinessId } = useSession();
  const bulletinCount = useBulletinCount(ownerBusinessId ?? undefined);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (isLoading) return <DashboardSkeleton />;
  if (!business) {
    // Owner id points at a listing that no longer exists — reset and re-claim.
    setOwnerBusinessId(null);
    return <Navigate to="/claim" replace />;
  }

  const { percent, nextAction } = listingCompleteness(business);
  const cap = LIMITS.free.bulletinsPerMonth ?? 0;
  const used = bulletinCount.data ?? 0;

  return (
    <div className="pb-6">
      {/* Topbar */}
      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Repeat size={13} /> Consumer view
        </button>
      </header>

      {/* Business header */}
      <section className="px-4 pt-2">
        <Card className="flex items-center gap-3 p-3">
          <Thumb src={business.photos[0]} seed={business.name} alt={business.name} className="h-12 w-12" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold leading-tight text-foreground">{business.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {business.verified ? (
                <VerifiedBadge />
              ) : (
                <StatusBadge tone="neutral">Not yet verified</StatusBadge>
              )}
              <StatusBadge tone="info">Free listing</StatusBadge>
            </div>
            <Link to={`/b/${business.slug}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-positive hover:underline">
              View public profile <ArrowRight size={12} />
            </Link>
          </div>
        </Card>
      </section>

      {/* Completeness */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 font-heading text-md font-semibold text-foreground">Profile completeness</h2>
        <Card className="p-4">
          <CompletenessMeter value={percent} label={percent >= 100 ? "All set" : "Looking good"} nextAction={nextAction} />
        </Card>
      </section>

      {/* Quick actions */}
      <section className="px-4 pt-4">
        <h2 className="mb-2 font-heading text-md font-semibold text-foreground">Quick actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <ActionTile
            icon={<Megaphone size={20} />}
            label="Post bulletin"
            badge={`${used}/${cap}`}
            onClick={() => navigate("/manage/bulletin/new")}
          />
          <ActionTile
            icon={<CalendarPlus size={20} />}
            label="Submit event"
            onClick={() => navigate("/manage/event/new")}
          />
          <ActionTile
            icon={<Pencil size={20} />}
            label="Edit listing"
            onClick={() => navigate("/manage/edit")}
          />
        </div>
      </section>

      {/* Status note */}
      <p className="px-4 pt-5 text-center text-xs text-muted-foreground">
        Your free listing is live and appears in search with equal ranking — no paid placement, ever.
      </p>
      {/* Seam: Member (analytics, demand signals) + Pro (Bookings/Inbox/Loyalty) render
          here when can(tier, …) is true. Not shown at MVP (no tiers/paywall/modules). */}
    </div>
  );
}

function ActionTile({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-3 text-center transition hover:bg-muted focus-visible:outline-none"
    >
      {badge && (
        <span className="absolute right-2 top-2 rounded-pill bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {badge}
        </span>
      )}
      <span className="text-positive">{icon}</span>
      <span className="text-xs font-medium leading-tight text-foreground">{label}</span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-6">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
