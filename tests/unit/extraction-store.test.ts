import { describe, it, expect } from "vitest";
import { useExtractionStore } from "@/stores/extraction-store";

// Regression: "Load 100 more" sets loadingMore: true, then waits on a
// WebSocket broadcast. A failed continuation (search provider error, worker
// crash) arrives as an "error" event, which the WS handler routes to
// setError. setError never reset loadingMore, so the button stayed
// permanently disabled, disabled={loadingMore}, forever, even across a
// later, entirely successful extraction, since nothing else in the store
// ever cleared it. The user experienced this as "Load more" hanging or the
// feature being broken, when the actual failure (an out-of-credits search
// provider) had already completed in under 2 seconds.
describe("setError", () => {
  it("clears loadingMore so a failed Load-more continuation doesn't strand the button", () => {
    useExtractionStore.setState({ loadingMore: true });

    useExtractionStore.getState().setError("Serper.dev HTTP 400: Not enough credits");

    const state = useExtractionStore.getState();
    expect(state.status).toBe("error");
    expect(state.errorMessage).toBe("Serper.dev HTTP 400: Not enough credits");
    expect(state.loadingMore).toBe(false);
  });
});

describe("hydrateResumable", () => {
  it("restores a completed-with-more session into the store", () => {
    useExtractionStore.getState().hydrateResumable({
      id: "session-1",
      totalYield: 97,
      phonesExtracted: 18,
      emailsVerified: 20,
      fullyEnriched: 20,
    });

    const state = useExtractionStore.getState();
    expect(state.status).toBe("complete");
    expect(state.stage).toBe("complete");
    expect(state.sessionId).toBe("session-1");
    expect(state.hasMore).toBe(true);
    expect(state.loadingMore).toBe(false);
    expect(state.locationsFound).toBe(97);
    expect(state.phonesExtracted).toBe(18);
    expect(state.emailsVerified).toBe(20);
    expect(state.fullyEnriched).toBe(20);
  });
});
