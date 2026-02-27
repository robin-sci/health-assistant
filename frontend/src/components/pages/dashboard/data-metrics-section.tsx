import { format } from 'date-fns';
import { Activity, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SymptomEntry, LabResult } from '@/lib/api/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d');
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

function severityClass(severity: number): string {
  if (severity <= 3)
    return 'bg-emerald-950 text-emerald-400 border-emerald-900';
  if (severity <= 6) return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  return 'bg-red-950 text-red-400 border-red-900';
}

function labStatusClass(status: string | null): string {
  if (!status) return 'border-zinc-800 text-zinc-500 bg-transparent';
  const s = status.toLowerCase();
  if (s === 'normal')
    return 'bg-emerald-950 text-emerald-400 border-emerald-900';
  if (s === 'high') return 'bg-red-950 text-red-400 border-red-900';
  if (s === 'low') return 'bg-yellow-950 text-yellow-400 border-yellow-900';
  if (s === 'critical')
    return 'bg-red-950 text-red-400 border-red-900 ring-1 ring-red-500';
  return 'border-zinc-800 text-zinc-500 bg-transparent';
}

function labStatusLabel(status: string | null): string {
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: number }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border ${severityClass(severity)}`}
    >
      {severity}/10
    </Badge>
  );
}

function LabStatusBadge({ status }: { status: string | null }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border ${labStatusClass(status)}`}
    >
      {labStatusLabel(status)}
    </Badge>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

// Keeping legacy interface names exported for backwards compat
export interface SeriesTypeMetric {
  series_type: string;
  count: number;
}

export interface WorkoutTypeMetric {
  workout_type: string | null;
  count: number;
}

export interface DataMetricsSectionProps {
  symptoms: SymptomEntry[];
  labs: LabResult[];
  isLoadingSymptoms?: boolean;
  isLoadingLabs?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DataMetricsSection({
  symptoms,
  labs,
  isLoadingSymptoms,
  isLoadingLabs,
  className,
}: DataMetricsSectionProps) {
  const recentSymptoms = symptoms.slice(0, 5);
  const recentLabs = labs.slice(0, 5);

  return (
    <div
      className={cn(
        'bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden',
        className
      )}
    >
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-white">Daily Overview</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Recent symptoms and latest lab results
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        {/* Recent Symptoms */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Recent Symptoms
            </h3>
          </div>

          {isLoadingSymptoms ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-2">
                  <div className="h-4 flex-1 bg-zinc-800 rounded" />
                  <div className="h-5 w-12 bg-zinc-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentSymptoms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Activity className="w-8 h-8 text-zinc-800" />
              <p className="text-xs text-zinc-600 text-center">
                No symptoms logged yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSymptoms.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 truncate">
                      {formatTypeName(entry.symptom_type)}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatDate(entry.recorded_at)}
                    </p>
                  </div>
                  <SeverityBadge severity={entry.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Lab Results */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              Latest Lab Results
            </h3>
          </div>

          {isLoadingLabs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-2">
                  <div className="h-4 flex-1 bg-zinc-800 rounded" />
                  <div className="h-5 w-14 bg-zinc-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentLabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <FlaskConical className="w-8 h-8 text-zinc-800" />
              <p className="text-xs text-zinc-600 text-center">
                No lab results yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLabs.map((lab) => (
                <div
                  key={lab.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 truncate">
                      {lab.test_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {lab.value}{' '}
                      <span className="text-zinc-600">{lab.unit}</span>
                      {' · '}
                      {formatDate(lab.recorded_at)}
                    </p>
                  </div>
                  <LabStatusBadge status={lab.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
