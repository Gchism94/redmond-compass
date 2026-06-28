import { useBusinessById } from "@/data/queries";
import { useSession } from "@/features/account/session";

/** The business the current user manages (owner path). `ownerBusinessId` from session. */
export function useOwnerBusiness() {
  const { ownerBusinessId } = useSession();
  const query = useBusinessById(ownerBusinessId ?? undefined);
  return { ownerBusinessId, ...query };
}
