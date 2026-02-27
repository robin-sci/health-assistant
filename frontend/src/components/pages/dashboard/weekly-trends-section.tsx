import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SymptomEntry } from '@/lib/api/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface DayBucket {
  day: string;
  date: Date;
  count: number;
  avgSeverity: number;
}

function buildDailyBuckets(symptoms: SymptomEntry[]): DayBucket[] {
  const today = startOfDay(new Date());
  const buckets: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    return {
      day: format(date, 'EEE'),
      date,
      count: 0,
      avgSeverity: 0,
    };
  });

  for (const entry of symptoms) {
    const entryDate = startOfDay(new Date(entry.recorded_at));
    const bucket = buckets.find((b) => isSameDay(b.date, entryDate));
    if (bucket) {
      bucket.count += 1;
      bucket.avgSeverity += entry.severity;
    }
  }

  for (const bucket of buckets) {
    if (bucket.count > 0) {
      bucket.avgSeverity =
        Math.round((bucket.avgSeverity / bucket.count) * 10) / 10;
    }
  }

  return buckets;
}

function barColor(avgSeverity: number): string {
  if (avgSeverity === 0) return '#3f3f46'; // zinc-700 for empty days
  if (avgSeverity <= 3) return '#34d399'; // emerald
  if (avgSeverity <= 6) return '#fbbf24'; // amber
  return '#f87171'; // red
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipEntry {
  value: number;
  payload: DayBucket;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  const data = entry.payload;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="text-white font-semibold">
        {data.count} symptom{data.count !== 1 ? 's' : ''}
      </p>
      {data.count > 0 && (
        <p className="text-zinc-400 mt-0.5">Avg severity: {data.avgSeverity}</p>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WeeklyTrendsSectionProps {
  symptoms: SymptomEntry[];
  isLoading?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeeklyTrendsSection({
  symptoms,
  isLoading,
  className,
}: WeeklyTrendsSectionProps) {
  const buckets = buildDailyBuckets(symptoms);
  const hasData = buckets.some((b) => b.count > 0);

  return (
    <div
      className={cn(
        'bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden',
        className
      )}
    >
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-white">Weekly Trends</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Symptom frequency over the last 7 days
        </p>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-3">
            <TrendingUp className="w-10 h-10 text-zinc-800" />
            <p className="text-sm text-zinc-600 text-center">
              Log symptoms to see trends
            </p>
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={buckets}
                margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: '#27272a' }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {buckets.map((bucket) => (
                    <Cell
                      key={bucket.day}
                      fill={barColor(bucket.avgSeverity)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
