// Guards against a later enrichment attempt (a retry, a rate-limited
// re-run, a concurrent duplicate call) silently downgrading a lead that
// already has a real, previously-confirmed email. A "not found" or "error"
// outcome on the CURRENT attempt should never overwrite a correct earlier
// result — only the lead's existing emailVerified flag decides whether a
// downgrade is allowed.
export function canDowngradeEnrichmentStatus(currentlyEmailVerified: boolean): boolean {
  return !currentlyEmailVerified;
}
