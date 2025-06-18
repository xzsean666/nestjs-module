import { Injectable, ConflictException } from '@nestjs/common';
import { db_tables, DBService } from '../common/db.service';
import { PGKVDatabase } from '../helpers/sdk/index';

@Injectable()
export class CheckinService {
  private checkinDB: PGKVDatabase;

  constructor(private readonly dbService: DBService) {
    this.checkinDB = dbService.getDBInstance(db_tables.user_checkin);
  }

  async getUserCheckinDaily(user_id: string) {
    const checkin = await this.checkinDB.get(user_id);
    return checkin;
  }

  async userCheckin(user_id: string) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7); // "YYYY-MM"
    const day = parseInt(today.substring(8, 10)); // 获取日期（1-31）

    // 获取当月记录
    const monthKey = `${user_id}:month:${yearMonth}`;
    const monthData = (await this.checkinDB.get(monthKey)) || {
      days: [], // 改为数组
      details: {},
    };
    // 获取统计数据
    const statsKey = `${user_id}:stats`;
    const currentStats = (await this.checkinDB.get(statsKey)) || {
      totalCheckins: 0,
      lastCheckin: null,
      streak: 0,
      monthlyStats: {},
    };

    // 检查是否已经签到，使用 ConflictException
    if (monthData.days.includes(day)) {
      // throw new ConflictException('Already checked in today');
      return currentStats;
    }

    // 计算连续签到
    if (currentStats.lastCheckin === this.yesterday(today)) {
      currentStats.streak += 1;
    } else {
      currentStats.streak = 1;
    }

    // 更新月度数据
    monthData.days.push(day); // 使用 push 替代 add
    monthData.details[day] = {
      timestamp: now.toISOString(),
    };

    // 更新统计数据
    currentStats.totalCheckins += 1;
    currentStats.lastCheckin = today;
    if (!currentStats.monthlyStats[yearMonth]) {
      currentStats.monthlyStats[yearMonth] = 0;
    }
    currentStats.monthlyStats[yearMonth] += 1;

    // 保存数据
    await this.checkinDB.merge(monthKey, {
      days: monthData.days, // 直接使用数组
      details: monthData.details,
    });
    await this.checkinDB.merge(statsKey, currentStats);
    // TODO: After checkin, generate tasks

    return currentStats;
  }

  async getCheckinHistory(user_id: string, year: number, month: number) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const monthKey = `${user_id}:month:${yearMonth}`;

    const monthData = (await this.checkinDB.get(monthKey)) || {
      days: [],
      details: {},
    };

    return {
      yearMonth,
      checkedInDays: monthData.days,
      details: monthData.details,
    };
  }

  async getCheckinStats(user_id: string) {
    const statsKey = `${user_id}:stats`;
    const stats = (await this.checkinDB.get(statsKey)) || {
      totalCheckins: 0,
      lastCheckin: null,
      streak: 0,
      monthlyStats: {},
    };
    return stats;
  }

  async getCurrentMonthCheckin(user_id: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() 返回 0-11

    return this.getCheckinHistory(user_id, currentYear, currentMonth);
  }

  async getCurrentWeekCheckin(user_id: string) {
    const now = new Date();
    // Convert JavaScript's day system (0=Sunday, 1=Monday, etc.) to 1=Monday, 7=Sunday
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();

    // Calculate the start of the week (Monday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (currentDay - 1)); // Monday is day 1

    // Calculate the end of the week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday is 6 days after Monday

    // Format dates for comparison
    const startDate = startOfWeek.toISOString().split('T')[0];
    const endDate = endOfWeek.toISOString().split('T')[0];

    // Get the year-month for both dates to handle week spanning two months
    const startYearMonth = startDate.substring(0, 7);
    const endYearMonth = endDate.substring(0, 7);

    // Create objects to store the week's check-in data
    const weekCheckins = {
      startDate,
      endDate,
      checkedInDays: [] as number[],
      details: {} as Record<string, any>,
    };

    // Get data for the start month
    const startMonthKey = `${user_id}:month:${startYearMonth}`;
    const startMonthData = (await this.checkinDB.get(startMonthKey)) || {
      days: [],
      details: {},
    };

    // If week spans two months, get data for the end month too
    let endMonthData = { days: [], details: {} };
    if (startYearMonth !== endYearMonth) {
      const endMonthKey = `${user_id}:month:${endYearMonth}`;
      endMonthData = (await this.checkinDB.get(endMonthKey)) || {
        days: [],
        details: {},
      };
    }

    // Process each day of the week
    for (let i = 0; i <= 6; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      const dateStr = currentDate.toISOString().split('T')[0];
      const day = parseInt(dateStr.substring(8, 10));
      const yearMonth = dateStr.substring(0, 7);

      // Check if user checked in on this day
      const monthData =
        yearMonth === startYearMonth ? startMonthData : endMonthData;

      if (monthData.days.includes(day)) {
        weekCheckins.checkedInDays.push(parseInt(dateStr.substring(8, 10)));
        weekCheckins.details[dateStr] = monthData.details[day];
      }
    }

    return weekCheckins;
  }

  // 辅助函数：获取前一天的日期
  private yesterday(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
}
