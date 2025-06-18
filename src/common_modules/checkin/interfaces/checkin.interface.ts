export interface CheckinRecord {
  days: number[];
  details: Record<number, { timestamp: string }>;
}

export interface CheckinStats {
  totalCheckins: number;
  lastCheckin: string | null;
  streak: number;
  monthlyStats: Record<string, number>;
}

export interface CheckinHistory {
  yearMonth: string;
  checkedInDays: number[];
  details: Record<string, any>;
}

export interface WeeklyCheckinData {
  startDate: string;
  endDate: string;
  checkedInDays: number[];
  details: Record<string, any>;
}
