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
  totalTimeSeconds: number;
  tasksCompleted: number;
  commentsAdded: number;
}

export interface AnalyticsData {
  dailyStats: DailyStats[];
  totalTimeSeconds: number;
  totalTasksCompleted: number;
  totalCommentsAdded: number;
  avgDailyTimeSeconds: number;
  topTasks: {
    taskId: string;
    taskName: string;
    totalTimeSeconds: number;
  }[];
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
