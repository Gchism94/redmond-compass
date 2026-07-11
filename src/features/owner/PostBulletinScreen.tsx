import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarClock, Megaphone } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Field, fieldInputClass, Button, Card, Skeleton } from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { useBulletinCount, useCreateBulletin } from "@/data/queries";
import { bulletinAllowance, LIMITS } from "@/lib/entitlements";
import { useI18n, getLocale } from "@/i18n";

const MAX = 280;

/**
 * Post Bulletin (B2). Free monthly cap — but a capped action NEVER destroys work:
 * over the cap, the post is offered as a free SCHEDULED bulletin for the reset date
 * instead of being blocked (BUILD-BRIEF §6).
 */
export function PostBulletinScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading } = useOwnerBusiness();
  const count = useBulletinCount(ownerBusinessId ?? undefined);
  const create = useCreateBulletin();

  const [body, setBody] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (isLoading || !business || count.isLoading) {
    return (
      <>
        <ScreenHeader title={t("owner.postBulletin")} back />
        <div className="space-y-3 px-4 pt-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </>
    );
  }

  const used = count.data ?? 0;
  const cap = LIMITS.free.bulletinsPerMonth ?? 0;
  const allowance = bulletinAllowance("free", used);
  const remaining = allowance.remaining === Infinity ? null : allowance.remaining;

  // Reset date = first day of next month (when the free cap refills).
  const now = new Date();
  const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = reset.toLocaleDateString(getLocale(), { month: "long", day: "numeric" });
  const resetISO = `${reset.getFullYear()}-${String(reset.getMonth() + 1).padStart(2, "0")}-01T08:00:00`;

  const valid = body.trim().length > 0 && body.length <= MAX;
  const linkCta = linkLabel.trim() && linkUrl.trim() ? { label: linkLabel.trim(), url: linkUrl.trim() } : undefined;

  const submit = async (schedule: boolean) => {
    await create.mutateAsync({
      businessId: ownerBusinessId,
      body: body.trim(),
      linkCta,
      ...(schedule ? { scheduledFor: resetISO, status: "scheduled" as const } : { status: "live" as const }),
    });
    navigate("/manage");
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={t("owner.postBulletin")} back />

      <div className="space-y-4 px-4 pt-1">
        {/* Cap status — quiet, not a countdown of doom */}
        {remaining !== null && (
          <p className="text-sm text-muted-foreground">
            {allowance.canPostNow
              ? t("owner.postsLeft", { n: remaining, cap })
              : t("owner.postsUsed", { cap })}
          </p>
        )}

        <Card className="space-y-3.5 p-4">
          <Field label={t("owner.bulletinLabel")} required htmlFor="b-body" hint={`${body.length}/${MAX}`}>
            <textarea
              id="b-body"
              rows={4}
              maxLength={MAX}
              className={fieldInputClass}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("owner.bulletinPlaceholder")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("owner.linkLabel")} htmlFor="b-ll">
              <input id="b-ll" className={fieldInputClass} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Order now" />
            </Field>
            <Field label={t("owner.linkUrl")} htmlFor="b-lu">
              <input id="b-lu" className={fieldInputClass} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" inputMode="url" />
            </Field>
          </div>
        </Card>

        {allowance.canPostNow ? (
          <Button variant="primary" size="lg" fullWidth disabled={!valid || create.isPending} onClick={() => submit(false)}>
            {create.isPending ? t("owner.posting") : <><Megaphone size={16} /> {t("owner.postNow")}</>}
          </Button>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-lg border border-positive/30 bg-positive/5 p-3 text-sm text-foreground">
              <p className="font-semibold text-positive">{t("owner.capSafe")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("owner.capScheduleMsg", { date: resetLabel })}
              </p>
            </div>
            <Button variant="positive" size="lg" fullWidth disabled={!valid || create.isPending} onClick={() => submit(true)}>
              {create.isPending ? t("owner.scheduling") : <><CalendarClock size={16} /> {t("owner.scheduleFree", { date: resetLabel })}</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
