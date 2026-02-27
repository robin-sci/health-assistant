import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Activity, AlertCircle, Plus, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useUsers } from '@/hooks/api/use-users';
import {
  useSymptoms,
  useSymptomTypes,
  useCreateSymptom,
} from '@/hooks/api/use-symptoms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { SymptomEntry, SymptomFrequency } from '@/lib/api/types';

export const Route = createFileRoute('/_authenticated/symptoms')({
  component: SymptomsPage,
});

// ── Constants ────────────────────────────────────────────────────────────────

const PREDEFINED_TYPES = [
  'migraine',
  'headache',
  'back_pain',
  'mood',
  'energy',
  'sleep_quality',
];

const DAYS_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d, yyyy HH:mm');
  } catch {
    return iso;
  }
}

function formatTypeName(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function severityVariant(
  severity: number
): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (severity <= 3) return 'default';
  if (severity <= 6) return 'secondary';
  return 'destructive';
}

function severityClass(severity: number): string {
  if (severity <= 3)
    return 'bg-emerald-950 text-emerald-400 border-emerald-900';
  if (severity <= 6) return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  return 'bg-red-950 text-red-400 border-red-900';
}

function barColor(avgSeverity: number): string {
  if (avgSeverity <= 3) return '#34d399';
  if (avgSeverity <= 6) return '#fbbf24';
  return '#f87171';
}

// ── Build frequency data ─────────────────────────────────────────────────────

function buildFrequencyData(entries: SymptomEntry[]): SymptomFrequency[] {
  const map = new Map<string, { count: number; totalSeverity: number }>();
  for (const entry of entries) {
    const existing = map.get(entry.symptom_type);
    if (existing) {
      existing.count += 1;
      existing.totalSeverity += entry.severity;
    } else {
      map.set(entry.symptom_type, { count: 1, totalSeverity: entry.severity });
    }
  }
  return Array.from(map.entries())
    .map(([symptom_type, { count, totalSeverity }]) => ({
      symptom_type,
      count,
      avg_severity: Math.round((totalSeverity / count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: number }) {
  return (
    <Badge
      variant={severityVariant(severity)}
      className={`text-xs font-medium border ${severityClass(severity)}`}
    >
      {severity}/10
    </Badge>
  );
}

// ── Trigger tags ─────────────────────────────────────────────────────────────

interface TriggerInputProps {
  triggers: string[];
  onChange: (triggers: string[]) => void;
}

function TriggerInput({ triggers, onChange }: TriggerInputProps) {
  const [inputValue, setInputValue] = useState('');

  function addTrigger() {
    const trimmed = inputValue.trim();
    if (trimmed && !triggers.includes(trimmed)) {
      onChange([...triggers, trimmed]);
    }
    setInputValue('');
  }

  function removeTrigger(trigger: string) {
    onChange(triggers.filter((t) => t !== trigger));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTrigger();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add trigger (press Enter)"
          className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 text-sm h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTrigger}
          className="h-9 border-zinc-800 text-zinc-400 hover:text-white shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {triggers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {triggers.map((trigger) => (
            <span
              key={trigger}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300 border border-zinc-700"
            >
              {trigger}
              <button
                type="button"
                onClick={() => removeTrigger(trigger)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick-entry form ─────────────────────────────────────────────────────────

interface QuickEntryFormProps {
  userId: string;
}

function QuickEntryForm({ userId }: QuickEntryFormProps) {
  const [symptomType, setSymptomType] = useState('');
  const [customType, setCustomType] = useState('');
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [recordedAt, setRecordedAt] = useState(() => {
    const now = new Date();
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });

  const { mutate: createSymptom, isPending } = useCreateSymptom();

  const isCustom = symptomType === '__custom__';
  const effectiveType = isCustom ? customType.trim() : symptomType;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveType) return;

    createSymptom(
      {
        user_id: userId,
        symptom_type: effectiveType,
        severity,
        notes: notes.trim() || null,
        recorded_at: new Date(recordedAt).toISOString(),
        duration_minutes: duration ? parseInt(duration, 10) : null,
        triggers: triggers.length > 0 ? triggers : null,
      },
      {
        onSuccess: () => {
          setSymptomType('');
          setCustomType('');
          setSeverity(5);
          setNotes('');
          setDuration('');
          setTriggers([]);
          setRecordedAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Symptom type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Symptom Type
        </Label>
        <Select value={symptomType} onValueChange={setSymptomType}>
          <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Select symptom…" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            {PREDEFINED_TYPES.map((type) => (
              <SelectItem
                key={type}
                value={type}
                className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
              >
                {formatTypeName(type)}
              </SelectItem>
            ))}
            <SelectItem
              value="__custom__"
              className="text-zinc-400 focus:bg-zinc-800 focus:text-white"
            >
              Custom…
            </SelectItem>
          </SelectContent>
        </Select>
        {isCustom && (
          <Input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Enter symptom name"
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 text-sm h-9 mt-2"
            autoFocus
          />
        )}
      </div>

      {/* Severity slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Severity
          </Label>
          <SeverityBadge severity={severity} />
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={severity}
          onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
          className="w-full h-1.5 appearance-none rounded-full bg-zinc-800 cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>0 — None</span>
          <span>5 — Moderate</span>
          <span>10 — Severe</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Notes
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional description…"
          className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 text-sm min-h-[72px] resize-none"
        />
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Duration (minutes)
        </Label>
        <Input
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 60"
          className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 text-sm h-9"
        />
      </div>

      {/* Triggers */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Triggers
        </Label>
        <TriggerInput triggers={triggers} onChange={setTriggers} />
      </div>

      {/* Date/time */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Recorded At
        </Label>
        <Input
          type="datetime-local"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="bg-zinc-900 border-zinc-800 text-white text-sm h-9 [color-scheme:dark]"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending || !effectiveType}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isPending ? 'Logging…' : 'Log Symptom'}
      </Button>
    </form>
  );
}

// ── Entries list ─────────────────────────────────────────────────────────────

interface EntriesListProps {
  entries: SymptomEntry[];
  isLoading: boolean;
}

function EntriesList({ entries, isLoading }: EntriesListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Activity className="w-10 h-10 text-zinc-700" />
        <p className="text-sm text-zinc-500">No symptom entries found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-900">
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Type
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Severity
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Notes
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Duration
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Triggers
            </th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 uppercase tracking-wide text-xs">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-zinc-900/50 hover:bg-zinc-900/40 transition-colors"
            >
              <td className="py-3 px-4">
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 bg-zinc-900/60 text-xs font-medium"
                >
                  {formatTypeName(entry.symptom_type)}
                </Badge>
              </td>
              <td className="py-3 px-4">
                <SeverityBadge severity={entry.severity} />
              </td>
              <td className="py-3 px-4 text-zinc-400 max-w-[200px] truncate">
                {entry.notes ?? <span className="text-zinc-700">—</span>}
              </td>
              <td className="py-3 px-4 text-zinc-500">
                {entry.duration_minutes !== null ? (
                  <span>{entry.duration_minutes}m</span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-3 px-4">
                {entry.triggers && entry.triggers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.triggers.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                      >
                        {t}
                      </span>
                    ))}
                    {entry.triggers.length > 3 && (
                      <span className="text-xs text-zinc-600">
                        +{entry.triggers.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                {formatDate(entry.recorded_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Frequency chart ───────────────────────────────────────────────────────────

interface FrequencyChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: SymptomFrequency }>;
  label?: string;
}

function FrequencyChartTooltip({
  active,
  payload,
  label,
}: FrequencyChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  const data = entry.payload;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-300 font-medium mb-1">
        {formatTypeName(label ?? '')}
      </p>
      <p className="text-white">
        <span className="text-zinc-400">Count: </span>
        {data.count}
      </p>
      <p className="text-white">
        <span className="text-zinc-400">Avg severity: </span>
        {data.avg_severity}
      </p>
    </div>
  );
}

interface FrequencyChartProps {
  entries: SymptomEntry[];
}

function FrequencyChart({ entries }: FrequencyChartProps) {
  const data = buildFrequencyData(entries);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Activity className="w-10 h-10 text-zinc-700" />
        <p className="text-sm text-zinc-500">
          No data available for chart analysis
        </p>
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
        >
          <XAxis
            dataKey="symptom_type"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatTypeName}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            content={<FrequencyChartTooltip />}
            cursor={{ fill: '#27272a' }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.symptom_type}
                fill={barColor(entry.avg_severity)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SymptomsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [selectedType, setSelectedType] = useState<string>('all');

  const { data: usersData } = useUsers({ limit: 1 });
  const userId = usersData?.items?.[0]?.id ?? '';

  const filterParams = {
    days,
    ...(selectedType !== 'all' ? { symptom_type: selectedType } : {}),
  };

  const {
    data: entries = [],
    isLoading: isLoadingEntries,
    error: entriesError,
    refetch: refetchEntries,
  } = useSymptoms(userId, filterParams);
  const {
    data: symptomTypes = [],
    isLoading: isLoadingTypes,
    error: symptomTypesError,
    refetch: refetchSymptomTypes,
  } = useSymptomTypes(userId);

  const isLoading = isLoadingEntries || isLoadingTypes || !userId;

  if (!isLoading && (entriesError || symptomTypesError)) {
    const errorMessage =
      entriesError instanceof Error
        ? entriesError.message
        : symptomTypesError instanceof Error
          ? symptomTypesError.message
          : 'An unexpected error occurred';

    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">
              Failed to load symptoms
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">{errorMessage}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              refetchEntries();
              refetchSymptomTypes();
            }}
            className="border-red-500/30 text-red-300 hover:text-red-200 hover:border-red-500/50"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-medium text-white">Symptom Tracking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Log and monitor your symptoms over time
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick entry form */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-900">
              <h2 className="text-sm font-semibold text-white">Log Symptom</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Record a new symptom entry
              </p>
            </div>
            <div className="p-6">
              {userId ? (
                <QuickEntryForm userId={userId} />
              ) : (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: entries + chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Days toggle */}
            <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDays(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    days === opt.value
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800 text-white h-8 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem
                  value="all"
                  className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
                >
                  All types
                </SelectItem>
                {symptomTypes.map((type) => (
                  <SelectItem
                    key={type}
                    value={type}
                    className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
                  >
                    {formatTypeName(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-zinc-600 ml-auto">
              {isLoading
                ? 'Loading…'
                : `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`}
            </span>
          </div>

          {/* Entries list */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-900">
              <h2 className="text-sm font-semibold text-white">
                Recent Entries
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Last {days} days
                {selectedType !== 'all'
                  ? ` · ${formatTypeName(selectedType)}`
                  : ''}
              </p>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <EntriesList entries={entries} isLoading={false} />
            )}
          </div>

          {/* Frequency chart */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-900">
              <h2 className="text-sm font-semibold text-white">
                Frequency by Type
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Entry count coloured by average severity
              </p>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <FrequencyChart entries={entries} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
