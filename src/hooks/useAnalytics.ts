import { useMemo } from "react";
import type { Project } from "../types";
import { type AnalyticsData, type AnalyticsScope, computeAnalytics } from "../lib/analyticsUtils";

export function useAnalytics(projects: Project[], scope: AnalyticsScope): AnalyticsData {
  return useMemo(() => computeAnalytics(projects, scope), [projects, scope]);
}
