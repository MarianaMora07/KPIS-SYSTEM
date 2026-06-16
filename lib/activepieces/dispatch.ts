export type ActivepiecesEvent =
  | "kpi.alert.created"
  | "kpi.alert.escalated"
  | "import.completed"
  | "import.failed"
  | "integration.failed"
  | "report.scheduled";

interface DispatchOptions {
  timeoutMs?: number;
}

function eventEnvKey(event: ActivepiecesEvent): string {
  return `ACTIVEPIECES_WEBHOOK_URL_${event.replace(/\./g, "_").toUpperCase()}`;
}

function resolveWebhookUrl(event: ActivepiecesEvent): string | null {
  const override = process.env[eventEnvKey(event)]?.trim();
  if (override) return override;

  const defaultUrl = process.env.ACTIVEPIECES_WEBHOOK_URL?.trim();
  return defaultUrl || null;
}

export function isActivepiecesConfigured(): boolean {
  if (process.env.ACTIVEPIECES_WEBHOOK_URL?.trim()) return true;

  const events: ActivepiecesEvent[] = [
    "kpi.alert.created",
    "kpi.alert.escalated",
    "import.completed",
    "import.failed",
    "integration.failed",
    "report.scheduled",
  ];

  return events.some((event) => Boolean(process.env[eventEnvKey(event)]?.trim()));
}

/** Envía un evento a Activepieces (fire-and-forget). Ver docs/activepieces-workflows.md */
export async function dispatchActivepiecesEvent(
  event: ActivepiecesEvent,
  payload: Record<string, unknown>,
  options: DispatchOptions = {}
): Promise<void> {
  const url = resolveWebhookUrl(event);
  if (!url) return;

  const timeoutMs = options.timeoutMs ?? 3000;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const secret = process.env.ACTIVEPIECES_WEBHOOK_SECRET?.trim();
  if (secret) {
    headers["x-webhook-secret"] = secret;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch {
    // Fire-and-forget: no bloquear flujo principal (HU-KPI-005 / HU-KPI-008)
  }
}
