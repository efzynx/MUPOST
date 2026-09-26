/**
 * Calendar Utilities for MuPost Content Calendar View
 *
 * Menyediakan fungsi-fungsi murni untuk pembuatan matriks kalender bulanan dan mingguan,
 * navigasi tanggal, dan pengelompokan postingan berdasarkan tanggal jadwal/publikasi.
 */

export interface CalendarPostTarget {
  id: string;
  connectedAccountId: string;
  platform: "META_PAGE" | "INSTAGRAM" | "TIKTOK" | "THREADS";
  status: string;
  accountName?: string;
}

export interface CalendarPostItem {
  id: string;
  textContent: string;
  mediaUrls: string[] | null;
  status:
    "DRAFT" | "SCHEDULED" | "QUEUED" | "PUBLISHING" | "PUBLISHED" | "PARTIAL" | "FAILED" | string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: CalendarPostTarget[];
}

export interface CalendarDay {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  posts: CalendarPostItem[];
}

export const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export const INDONESIAN_DAYS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

export const INDONESIAN_DAYS_FULL = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

/**
 * Format Date ke string YYYY-MM-DD lokal
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dapatkan tanggal relevan dari sebuah postingan:
 * Prioritas: scheduledAt -> publishedAt -> createdAt
 */
export function getPostEffectiveDate(post: CalendarPostItem): Date {
  const dateStr = post.scheduledAt || post.publishedAt || post.createdAt;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Periksa apakah dua tanggal berada pada hari yang sama (tahun, bulan, tanggal)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Periksa apakah sebuah tanggal adalah hari ini
 */
export function isDateToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Format jam menit dari ISO date string (cth: "14:30")
 */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "--:--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Format Bulan dan Tahun (cth: "Maret 2026")
 */
export function formatMonthYear(date: Date): string {
  const monthName = INDONESIAN_MONTHS[date.getMonth()];
  return `${monthName} ${date.getFullYear()}`;
}

/**
 * Format rentang minggu (cth: "23 – 29 Maret 2026" atau "28 Des 2025 – 3 Jan 2026")
 */
export function formatWeekRange(startDate: Date, endDate: Date): string {
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = INDONESIAN_MONTHS[startDate.getMonth()];
  const endMonth = INDONESIAN_MONTHS[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

/**
 * Kelompokkan postingan ke dalam map tanggal YYYY-MM-DD
 */
export function groupPostsByDate(posts: CalendarPostItem[]): Map<string, CalendarPostItem[]> {
  const map = new Map<string, CalendarPostItem[]>();

  for (const post of posts) {
    const effDate = getPostEffectiveDate(post);
    const key = toDateKey(effDate);
    const list = map.get(key);
    if (list) {
      list.push(post);
    } else {
      map.set(key, [post]);
    }
  }

  // Urutkan postingan di setiap hari berdasarkan jam terkecil lebih dahulu
  map.forEach((postList, key) => {
    postList.sort((a: CalendarPostItem, b: CalendarPostItem) => {
      const timeA = getPostEffectiveDate(a).getTime();
      const timeB = getPostEffectiveDate(b).getTime();
      return timeA - timeB;
    });
    map.set(key, postList);
  });

  return map;
}

/**
 * Dapatkan hari Senin dari minggu yang mencakup tanggal acuan
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const day = d.getDay();
  // Jarak mundur ke hari Senin: Minggu (0) mundur 6 hari, lainnya mundur (day - 1) hari
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Buat matriks 7 hari untuk tampilan mingguan (Senin s/d Minggu)
 */
export function getWeekDays(baseDate: Date, posts: CalendarPostItem[] = []): CalendarDay[] {
  const monday = getMondayOfWeek(baseDate);
  const postsMap = groupPostsByDate(posts);
  const days: CalendarDay[] = [];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = toDateKey(current);
    const dayOfWeek = current.getDay(); // 0 is Sun, 6 is Sat

    days.push({
      date: current,
      dateString: key,
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === baseDate.getMonth(),
      isToday: isDateToday(current),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      posts: postsMap.get(key) || [],
    });
  }

  return days;
}

/**
 * Buat matriks kalender bulanan lengkap (35 atau 42 sel) diawali hari Senin
 */
export function getMonthDays(baseDate: Date, posts: CalendarPostItem[] = []): CalendarDay[] {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const postsMap = groupPostsByDate(posts);

  // Tanggal 1 bulan ini
  const firstDayOfMonth = new Date(year, month, 1);
  // Hari dalam seminggu untuk tanggal 1 (0 = Minggu, 1 = Senin, ...)
  const firstDayWeekday = firstDayOfMonth.getDay();
  // Berapa hari mundur ke Senin terdekat
  const daysBefore = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

  // Tanggal awal matriks kalender
  const startDate = new Date(year, month, 1 - daysBefore);

  // Jumlah hari total: 35 (5 minggu) atau 42 (6 minggu)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysNeeded = daysBefore + daysInMonth;
  const gridCellsCount = totalDaysNeeded > 35 ? 42 : 35;

  const days: CalendarDay[] = [];

  for (let i = 0; i < gridCellsCount; i++) {
    const current = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i
    );
    const key = toDateKey(current);
    const dayOfWeek = current.getDay();

    days.push({
      date: current,
      dateString: key,
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === month,
      isToday: isDateToday(current),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      posts: postsMap.get(key) || [],
    });
  }

  return days;
}

/**
 * Navigasi tanggal: Bulan berikutnya
 */
export function getNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/**
 * Navigasi tanggal: Bulan sebelumnya
 */
export function getPrevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

/**
 * Navigasi tanggal: Minggu berikutnya (maju 7 hari)
 */
export function getNextWeek(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 7);
  return next;
}

/**
 * Navigasi tanggal: Minggu sebelumnya (mundur 7 hari)
 */
export function getPrevWeek(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  return prev;
}
