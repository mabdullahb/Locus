import { describe, it, expect } from "vitest";
import { sortLeads, type Lead } from "@/stores/leads-store";

// Regression: sorting by Email or Phone used to require two clicks to see
// useful data — ascending order put blank values first (nothing sorts
// before ""), so the first click surfaced only leads with no email/phone,
// and only the second click (which flips to descending) happened to put
// real values on top. Fixed by making blanks always sort last regardless
// of direction.

function lead(overrides: Partial<Lead>): Lead {
  return {
    id: overrides.id ?? "1",
    sessionId: overrides.sessionId ?? "session-1",
    businessName: overrides.businessName ?? "Business",
    location: overrides.location ?? "",
    phone: overrides.phone ?? "",
    email: overrides.email ?? "",
    status: overrides.status ?? "pending",
    createdAt: overrides.createdAt ?? 0,
  };
}

describe("sortLeads", () => {
  it("puts blank emails last on the first (ascending) click", () => {
    const leads = [
      lead({ id: "a", email: "" }),
      lead({ id: "b", email: "zack@example.com" }),
      lead({ id: "c", email: "" }),
      lead({ id: "d", email: "amy@example.com" }),
    ];

    const sorted = sortLeads(leads, "email", "asc");

    expect(sorted.map((l) => l.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("still puts blanks last on descending — direction only reorders real values", () => {
    const leads = [
      lead({ id: "a", email: "" }),
      lead({ id: "b", email: "zack@example.com" }),
      lead({ id: "c", email: "" }),
      lead({ id: "d", email: "amy@example.com" }),
    ];

    const sorted = sortLeads(leads, "email", "desc");

    expect(sorted.map((l) => l.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("applies the same blanks-last rule to phone", () => {
    const leads = [
      lead({ id: "a", phone: "" }),
      lead({ id: "b", phone: "9999999999" }),
    ];

    const sorted = sortLeads(leads, "phone", "asc");

    expect(sorted.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("returns leads unchanged when no column is selected", () => {
    const leads = [lead({ id: "a" }), lead({ id: "b" })];
    expect(sortLeads(leads, null, "asc")).toEqual(leads);
  });

  it("sorts normally when no values are blank", () => {
    const leads = [
      lead({ id: "a", businessName: "Zeta" }),
      lead({ id: "b", businessName: "Alpha" }),
    ];
    const sorted = sortLeads(leads, "businessName", "asc");
    expect(sorted.map((l) => l.id)).toEqual(["b", "a"]);
  });
});
