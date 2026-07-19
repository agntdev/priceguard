export interface AlertLogEntry {
  userId: number;
  ticker: string;
  alertType: string;
  direction: string;
  value: number;
  price: number;
  currency: string;
  timestamp: number;
}

export interface OwnerMetrics {
  totalUsers: number;
  activeUsersLast30d: number;
  alertCounts: Record<string, number>;
  alertTypeCounts: Record<string, number>;
  recentFailures: number;
  recentAlerts: AlertLogEntry[];
}

interface MetricsStore {
  userInteractions: Map<number, number>;
  alertLog: AlertLogEntry[];
  alertCounts: Record<string, number>;
  alertTypeCounts: Record<string, number>;
  failures: number;
}

const store: MetricsStore = {
  userInteractions: new Map(),
  alertLog: [],
  alertCounts: {},
  alertTypeCounts: {},
  failures: 0,
};

export function recordUserInteraction(userId: number, timestamp: number): void {
  store.userInteractions.set(userId, timestamp);
}

export function recordAlert(entry: AlertLogEntry): void {
  store.alertLog.push(entry);
  store.alertCounts[entry.ticker] = (store.alertCounts[entry.ticker] ?? 0) + 1;
  store.alertTypeCounts[entry.alertType] =
    (store.alertTypeCounts[entry.alertType] ?? 0) + 1;
}

export function recordFailure(): void {
  store.failures++;
}

export function getOwnerMetrics(nowMs: number): OwnerMetrics {
  const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
  let activeUsers = 0;
  for (const [, ts] of store.userInteractions) {
    if (ts >= thirtyDaysAgo) activeUsers++;
  }

  return {
    totalUsers: store.userInteractions.size,
    activeUsersLast30d: activeUsers,
    alertCounts: { ...store.alertCounts },
    alertTypeCounts: { ...store.alertTypeCounts },
    recentFailures: store.failures,
    recentAlerts: store.alertLog.slice(-50),
  };
}

export function getRecentAlerts(limit = 20): AlertLogEntry[] {
  return store.alertLog.slice(-limit);
}

export function resetMetricsStore(): void {
  store.userInteractions.clear();
  store.alertLog.length = 0;
  store.alertCounts = {};
  store.alertTypeCounts = {};
  store.failures = 0;
}
