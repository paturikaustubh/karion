// ─── Reference Types ──────────────────────────────────────────────────────────

export interface StatusRef {
  statusName: string;
  displayName: string;
}

export interface SeverityRef {
  severityName: string;
  displayName: string;
}

export interface SourceRef {
  sourceName: string;
  displayName: string;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  fullName: string;
  username: string;
  email: string;
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export interface TaskWithRelations {
  taskId: string;
  taskName: string;
  description: string | null;
  taskStatus: StatusRef;
  taskSeverity: SeverityRef;
  creationSource: SourceRef;
  dueDate: Date | null;
  totalWorkTime: number;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    comments: number;
    timeSessions: number;
  };
}

export interface TaskDetail extends TaskWithRelations {
  comments: CommentItem[];
  timeSessions: TimeSessionItem[];
  activities: ActivityLogItem[];
}

// ─── Comment Types ────────────────────────────────────────────────────────────

export interface CommentItem {
  taskCommentId: string;
  taskId: string;
  comment: string;
  commentSource: SourceRef;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Time Session Types ───────────────────────────────────────────────────────

export interface TimeSessionItem {
  taskSessionId: string;
  taskId: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  activeSession: boolean;
}

export interface ActiveSession extends TimeSessionItem {
  task: {
    taskId: string;
    taskName: string;
    taskStatus: StatusRef;
  };
}

// ─── Activity Log Types ───────────────────────────────────────────────────────

export interface ActivityLogItem {
  taskActivityId: string;
  taskId: string | null;
  activityType: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  task?: {
    taskId: string;
    taskName: string;
  } | null;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface ReportItem {
  reportId: string;
  reportDate: Date;
  content: string;
  structuredData: Record<string, unknown> | null;
  generatedAt: Date;
}

export interface ReportConfigItem {
  reportConfigId: string;
  frequency: string;
  scheduledTime: string | null;
  datesDays: unknown | null;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  taskTimeSeconds: number;      // sum of all session durations for the day
  wallClockSeconds: number;     // merged intervals (deduped)
  tasksCompleted: number;
  commentsAdded: number;
}

export interface DistributionItem {
  name: string;        // statusName / severityName
  displayName: string;
  count: number;
}

export interface HourlyBucket {
  hour: number;        // 0–23
  seconds: number;
}

export interface AnalyticsData {
  dailyStats: DailyStats[];
  // task time = sum of all session durations (can exceed 24h if parallel)
  totalTaskTimeSeconds: number;
  // wall clock = merged intervals (never exceeds real time elapsed)
  totalWallClockSeconds: number;
  // efficiencyMultiplier = totalTaskTime / totalWallClock (1.0x if no parallel)
  efficiencyMultiplier: number;
  isRunning: boolean;
  sessionStartedAt: string | null;
  totalTasksCompleted: number;
  totalCommentsAdded: number;
  avgDailyWallClockSeconds: number;
  topTasks: {
    taskId: string;
    taskName: string;
    totalTimeSeconds: number;
  }[];
  statusDistribution: DistributionItem[];
  severityDistribution: DistributionItem[];
  hourlyDistribution: HourlyBucket[];
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardData {
  // Today's snapshot
  todayWallClockSeconds: number;
  todayTaskTimeSeconds: number;
  todayIsRunning: boolean;
  todaySessionStartedAt: string | null;
  todayCompleted: number;
  todayDueCount: number;
  overdueCount: number;
  activeTask: {
    taskId: string;
    taskName: string;
    sessionStartedAt: string;
    taskTimeSeconds: number;
  } | null;
  // This week
  weekDailyStats: { date: string; wallClockSeconds: number; taskTimeSeconds: number }[];
  weekWallClockSeconds: number;
  weekTaskTimeSeconds: number;
  weekIsRunning: boolean;
  weekSessionStartedAt: string | null;
  weekEfficiency: number;
  // Status snapshot (all open tasks)
  statusDistribution: DistributionItem[];
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
