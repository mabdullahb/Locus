# Security Policy

## Reporting a vulnerability

Do not open a public issue for security problems.

Use GitHub's private vulnerability reporting on this repository
(Security tab, "Report a vulnerability"). Include:

- what the issue is and where in the code
- steps or a proof of concept to reproduce it
- the impact you think it has

You will get an acknowledgement within a few days. Fix timelines depend on
severity and complexity.

## Scope

In scope: this codebase and its default configuration.

Out of scope: issues that need a misconfigured deployment (no `NEXTAUTH_SECRET`,
a publicly exposed worker port with `INTERNAL_API_SECRET` unset, debug settings),
vulnerabilities in third-party providers, and anything requiring physical or
privileged access to the host.

## Known limitations

- `next-auth` is on v4, whose `@auth/core` has open advisories. They do not
  apply to this configuration: no OAuth providers (the state/nonce/PKCE cookie
  binding issue), credentials-only login with no email provider (the homoglyph
  normalisation issue), and no Bearer-token API auth (the `getToken()` crash).
  Moving to Auth.js v5 is planned but not security-urgent here.
- `xlsx` (SheetJS) has prototype-pollution and ReDoS advisories with no npm
  fix. Usage is write-only (no `XLSX.read`), so the parsing-side attack surface
  is not reachable.
- The admin-only 9Router enrichment provider sends the caller's API key in an
  Authorization header. `NINE_ROUTER_BASE_URL` must be https for a public host.
  Plain http is allowed for localhost or a LAN address, or for a public host
  only when `NINE_ROUTER_ALLOW_INSECURE_HTTP=true` is set deliberately.
- The SSRF guard on outbound webhook URLs validates at request time but does not
  pin the connection, so DNS rebinding is a residual risk.
- Rate limiting is in-process, so it is per-instance on a multi-instance deploy.
