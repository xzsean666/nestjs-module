import { Injectable, ConflictException } from '@nestjs/common';
import { DBService } from '../common/db.service';
import { KVDatabase } from '../sdk/index';
import type { User } from '@supabase/supabase-js';
@Injectable()
export class UserService {
  private userDB: KVDatabase;
  private checkinDB: KVDatabase;
  constructor(private readonly dbService: DBService) {
    this.userDB = dbService.getDBInstance('user');
    this.checkinDB = dbService.getDBInstance('checkin');
  }

  async getUserPrivateProfile(user: User) {
    const userProfile = await this.userDB.get(user.id);
    return userProfile;
  }

  async updateUserPrivateProfile(user: User, profile: JSON) {
    console.log(user.id, profile);
    await this.userDB.merge(user.id, profile);
    return profile;
  }

  async getUserCheckinDaily(user: User) {
    const checkin = await this.checkinDB.get(user.id);
    return checkin;
  }

  async userCheckin(user: User) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7); // "YYYY-MM"
    const day = parseInt(today.substring(8, 10)); // 获取日期（1-31）

    // 获取当月记录
    const monthKey = `${user.id}:month:${yearMonth}`;
    const monthData = (await this.checkinDB.get(monthKey)) || {
      days: [], // 改为数组
      details: {},
    };

    // 检查是否已经签到，使用 ConflictException
    if (monthData.days.includes(day)) {
      throw new ConflictException('Already checked in today');
    }

    // 获取统计数据
    const statsKey = `${user.id}:stats`;
    const currentStats = (await this.checkinDB.get(statsKey)) || {
      totalCheckins: 0,
      lastCheckin: null,
      streak: 0,
      monthlyStats: {},
    };

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

    return currentStats;
  }

  async getCheckinHistory(user: User, year: number, month: number) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const monthKey = `${user.id}:month:${yearMonth}`;

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

  async getCheckinStats(user: User) {
    const statsKey = `${user.id}:stats`;
    const stats = (await this.checkinDB.get(statsKey)) || {
      totalCheckins: 0,
      lastCheckin: null,
      streak: 0,
      monthlyStats: {},
    };
    return stats;
  }

  async getCurrentMonthCheckin(user: User) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() 返回 0-11

    return this.getCheckinHistory(user, currentYear, currentMonth);
  }

  // 辅助函数：获取前一天的日期
  private yesterday(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
}
