import { moment } from "obsidian";

/**
 * 格式化日期
 * @param timestamp 时间戳（毫秒）
 * @param format 日期格式
 * @returns 格式化后的日期字符串
 */
export function formatDate(timestamp: number, format: string): string {
    return moment(timestamp).format(format);
}

/**
 * 获取今天的开始时间戳
 * @returns 今天零点的时间戳（毫秒）
 */
export function getTodayStartTimestamp(): number {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return todayStart.getTime();
}

/**
 * 获取今天的结束时间戳
 * @returns 今天结束的时间戳（毫秒）
 */
export function getTodayEndTimestamp(): number {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return todayEnd.getTime();
}

/**
 * 获取本周的开始时间戳
 * @returns 本周一零点的时间戳（毫秒）
 */
export function getWeekStartTimestamp(): number {
    const now = new Date();
    const day = now.getDay() || 7; // 将周日的0转换为7
    const diff = now.getDate() - day + 1; // 调整到本周一
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.getTime();
}

/**
 * 获取相对时间描述
 * @param timestamp 时间戳（毫秒）
 * @param fallbackFormat 超过一周时的日期格式（可选，默认 YYYY-MM-DD）
 * @returns 相对时间描述字符串
 */
export function getRelativeTimeString(timestamp: number, fallbackFormat: string = "YYYY-MM-DD"): string {
    const now = Date.now();
    const diff = now - timestamp;

    // 小于1分钟
    if (diff < 60 * 1000) {
        return "刚刚";
    }
    
    // 小于1小时
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes}分钟前`;
    }
    
    // 小于1天
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours}小时前`;
    }
    
    // 小于1周
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days}天前`;
    }
    
    // 大于1周，返回具体日期（可配置格式）
    return formatDate(timestamp, fallbackFormat);
} 
