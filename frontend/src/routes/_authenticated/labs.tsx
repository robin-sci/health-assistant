import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { FlaskConical, TrendingUp, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useUsers } from '@/hooks/api/use-users';
import { useLabs, useLabTrend, useLabTestNames } from '@/hooks/api/use-labs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LabResult, LabTrendPoint } from '@/lib/api/types';

export const Route = createFileRoute('/_authenticated/labs')({
  component: LabsPage,
});

// ── helpers ────────────────────────────────────────────────────────────────

function statusColor(
  status: string | null
): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (!status) return 'outline';
  const s = status.toLowerCase();
  if (s === 'high') return 'destructive';
  if (s === 'low') return 'secondary';
  if (s === 'normal') return 'default';
  return 'outline';
}

function statusLabel(status: string | null): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function formatChartDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM yyyy');
  } catch {
    return iso;
  }
}

// ── sub-components ─────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string | null;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const variant = statusColor(status);
  const label = statusLabel(status);

  // Map variant to explicit class since shadcn secondary is gray
  const cls = !status
    ? 'border-zinc-800 text-zinc-500 bg-transparent'
    : status.toLowerCase() === 'normal'
      ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
      : status.toLowerCase() === 'high'
        ? 'bg-red-950 text-red-400 border-red-900'
        : status.toLowerCase() === 'low'
          ? 'bg-yellow-950 text-yellow-400 border-yellow-900'
          : 'border-zinc-800 text-zinc-500 bg-transparent';

  return (
    <Badge variant={variant} className={`text-xs font-medium border ${cls}`}>
      {label}
    </Badge>
  );
}

// ── Recent labs table ───────────────────────────────────────────────────────

interface RecentLabsTableProps {
  labs: LabResult[];
}

function RecentLabsTable({ labs }: RecentLabsTableProps) {
  if (labs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <FlaskConical className="w-10 h-10 text-zinc-700" />
        <p className="text-sm text-zinc-500">No lab results found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-900">
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Test Name
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Value
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Reference Range
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Status
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {labs.map((lab) => (
            <tr
              key={lab.id}
              className="border-b border-zinc-900/50 hover:bg-zinc-900/40 transition-colors"
            >
              <td className="py-3 px-4 text-white font-medium">
                {lab.test_name}
              </td>
              <td className="py-3 px-4 text-zinc-300">
                {lab.value}{' '}
                <span className="text-zinc-500 text-xs">{lab.unit}</span>
              </td>
              <td className="py-3 px-4 text-zinc-500">
                {lab.reference_min !== null && lab.reference_max !== null
                  ? `${lab.reference_min} – ${lab.reference_max}`
                  : lab.reference_min !== null
                    ? `≥ ${lab.reference_min}`
                    : lab.reference_max !== null
                      ? `≤ ${lab.reference_max}`
                      : '—'}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={lab.status} />
              </td>
              <td className="py-3 px-4 text-zinc-500">
                {formatDate(lab.recorded_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Custom tooltip ──────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  value: number;
  payload: LabTrendPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  const point = entry.payload;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{formatDate(point.recorded_at)}</p>
      <p className="text-white font-semibold text-sm">
        {point.value}{' '}
        <span className="text-zinc-400 font-normal">{point.unit}</span>
      </p>
      {point.status && (
        <p className="mt-1">
          <StatusBadge status={point.status} />
        </p>
      )}
    </div>
  );
}

// ── Trend chart ─────────────────────────────────────────────────────────────

interface TrendChartProps {
  userId: string;
  testName: string;
  testNames: string[];
  onTestNameChange: (name: string) => void;
}

function TrendChart({
  userId,
  testName,
  testNames,
  onTestNameChange,
}: TrendChartProps) {
  const { data: trend, isLoading, error } = useLabTrend(userId, testName);

  const chartData = trend?.data_points.map((pt) => ({
    ...pt,
    date: formatChartDate(pt.recorded_at),
  }));

  // Compute reference lines from first data point that has them
  const refPoint = trend?.data_points.find(
    (pt) => pt.reference_min !== null || pt.reference_max !== null
  );

  return (
    <div className="space-y-4">
      {/* Selector row */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-blue-400 shrink-0" />
        <Select value={testName} onValueChange={onTestNameChange}>
          <SelectTrigger className="w-[280px] bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Select a test…" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            {testNames.map((name) => (
              <SelectItem
                key={name}
                value={name}
                className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
              >
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {trend && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-zinc-500">Latest:</span>
            <span className="text-sm font-semibold text-white">
              {trend.latest_value ?? '—'}{' '}
              <span className="text-zinc-400 font-normal text-xs">
                {trend.unit}
              </span>
            </span>
            {trend.latest_status && (
              <StatusBadge status={trend.latest_status} />
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[320px] w-full">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error || !chartData || chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              {error
                ? 'Failed to load trend data'
                : 'No data available for this test'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              {refPoint?.reference_min !== null &&
                refPoint?.reference_min !== undefined && (
                  <ReferenceLine
                    y={refPoint.reference_min}
                    stroke="#fbbf24"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{
                      value: 'Min',
                      fill: '#fbbf24',
                      fontSize: 10,
                      position: 'insideBottomRight',
                    }}
                  />
                )}
              {refPoint?.reference_max !== null &&
                refPoint?.reference_max !== undefined && (
                  <ReferenceLine
                    y={refPoint.reference_max}
                    stroke="#f87171"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{
                      value: 'Max',
                      fill: '#f87171',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#60a5fa', strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function LabsPage() {
  const [selectedTest, setSelectedTest] = useState<string>('');

  const { data: usersData } = useUsers({ limit: 1 });
  const userId = usersData?.items?.[0]?.id ?? '';

  const { data: labs = [], isLoading: isLoadingLabs } = useLabs(userId);
  const { data: testNames = [], isLoading: isLoadingTestNames } =
    useLabTestNames(userId);

  // Auto-select first test name once loaded
  const effectiveTest =
    selectedTest || (testNames.length > 0 ? (testNames[0] ?? '') : '');

  const isLabsLoading = isLoadingLabs || !userId;
  const isTestNamesLoading = isLoadingTestNames || !userId;

  return (
    <div className="p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <FlaskConical className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-medium text-white">Lab Results</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Blood test history and trends
          </p>
        </div>
      </div>

      {/* Recent labs */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Labs</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isLabsLoading
                ? 'Loading…'
                : `${labs.length} result${labs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {isLabsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <RecentLabsTable labs={labs} />
        )}
      </div>

      {/* Trend chart */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-900">
          <h2 className="text-sm font-semibold text-white">Trend Chart</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track how a marker changes over time
          </p>
        </div>

        <div className="p-6">
          {isTestNamesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : testNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <TrendingUp className="w-10 h-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                No test data available for trend analysis
              </p>
            </div>
          ) : (
            <TrendChart
              userId={userId}
              testName={effectiveTest}
              testNames={testNames}
              onTestNameChange={setSelectedTest}
            />
          )}
        </div>
      </div>
    </div>
  );
}
