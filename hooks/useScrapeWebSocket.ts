"use client";

import { useEffect, useRef } from "react";
import { useExtractionStore } from "@/stores/extraction-store";
import { useLeadsStore } from "@/stores/leads-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";

export function useScrapeWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`${WS_URL}?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const { event: type, data } = JSON.parse(event.data);
        const store = useExtractionStore.getState();

        switch (type) {
          case "stage":
            store.setStage(data.stage, data.progress, data.metrics || {});
            break;
          case "metrics":
            store.updateMetrics(data.metrics);
            break;
          case "complete":
            store.setComplete(data.totalYield || 0);
            useLeadsStore.getState().addLeads(data.leads || []);
            break;
          case "error":
            store.setError(data.message);
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);
}
