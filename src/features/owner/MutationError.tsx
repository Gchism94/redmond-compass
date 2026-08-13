import { ErrorState } from "@/components";
import { classifyMutationError } from "@/lib/errors";
import { useSession } from "@/features/account/session";
import { useI18n } from "@/i18n";

/**
 * The one way an owner-path WRITE reports failure — used by all five owner mutations
 * (claim, create listing, edit listing, post bulletin, submit event) so a failure looks and
 * behaves the same wherever it happens.
 *
 * Two things it does that a plain "something went wrong" cannot:
 *  • names the failure, because the fix differs (reconnect / sign in again / not your
 *    listing / already exists);
 *  • offers the RIGHT action — an expired session gets a sign-in button, not a retry that
 *    is guaranteed to fail again.
 *
 * Renders nothing when `error` is null, so call sites can drop it in unconditionally.
 */
export function MutationError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const session = useSession();
  if (!error) return null;

  const { key, serverMessage, needsAuth } = classifyMutationError(error);
  return (
    <ErrorState
      compact
      title={t(key)}
      message={serverMessage}
      // Retrying an expired session just fails again — send them to sign-in instead.
      onRetry={needsAuth ? () => session.openAuth("account") : onRetry}
      retryLabel={needsAuth ? t("account.signIn") : undefined}
    />
  );
}
