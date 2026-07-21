export interface EtaInput {
  recordsFound: number;
  recordsTarget: number;
  elapsedSeconds: number;
  stage: string;
}

export interface EtaResult {
  seconds: number;
  label: string;
}

const STAGE_WEIGHTS: Record<string, number> = {
  initializing: 0.05,
  navigating: 0.25,
  parsing: 0.30,
  enriching: 0.25,
  formatting: 0.15,
};

export function calculateEta(input: EtaInput): EtaResult {
  const { recordsFound, recordsTarget, elapsedSeconds, stage } = input;

  if (recordsFound === 0 || elapsedSeconds === 0) {
    return { seconds: 45, label: "~45s" };
  }

  const ratePerSecond = recordsFound / elapsedSeconds;
  const remaining = Math.max(0, recordsTarget - recordsFound);
  const etaAtRate = ratePerSecond > 0 ? remaining / ratePerSecond : 60;

  const stageRemaining = STAGE_WEIGHTS[stage]
    ? STAGE_WEIGHTS[stage] * 120
    : 30;

  const total = Math.round(Math.max(etaAtRate, stageRemaining));

  if (total > 120) {
    const mins = Math.round(total / 60);
    return { seconds: total, label: `~${mins} min` };
  }
  return { seconds: total, label: `~${total}s` };
}

export function formatEta(seconds: number): string {
  if (seconds > 120) {
    return `~${Math.round(seconds / 60)} min`;
  }
  return `~${Math.max(1, seconds)}s`;
}
