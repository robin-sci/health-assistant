import { createFileRoute } from '@tanstack/react-router';
import { HeartPulse } from 'lucide-react';
import { useUsers } from '@/hooks/api/use-users';
import { useSymptoms } from '@/hooks/api/use-symptoms';
import { useLabs } from '@/hooks/api/use-labs';
import { useDocuments } from '@/hooks/api/use-documents';
import { useChatSessions } from '@/hooks/api/use-chat';
import {
  StatsGrid,
  DataMetricsSection,
  QuickActionsSection,
  DashboardLoadingState,
  WeeklyTrendsSection,
} from '@/components/pages/dashboard';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

// ── Page ──────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const { data: usersData, isLoading: isLoadingUser } = useUsers({
    sort_by: 'created_at',
    sort_order: 'desc',
    limit: 1,
  });

  const userId = usersData?.items?.[0]?.id ?? '';

  const { data: symptoms7d = [], isLoading: isLoadingSymptoms } = useSymptoms(
    userId,
    { days: 7 }
  );

  const { data: allLabs = [], isLoading: isLoadingLabs } = useLabs(userId);

  const { data: documents = [] } = useDocuments(userId);

  const { data: chatSessions = [] } = useChatSessions(userId);

  if (isLoadingUser) {
    return <DashboardLoadingState />;
  }

  return (
    <div className="p-8 space-y-6 min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <HeartPulse className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-medium text-white">Health Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Your personal health overview at a glance
          </p>
        </div>
      </div>

      {/* ── Health Stats Row ────────────────────────────────────────────────── */}
      <StatsGrid
        symptomsThisWeek={symptoms7d.length}
        totalLabs={allLabs.length}
        totalDocuments={documents.length}
        totalChatSessions={chatSessions.length}
      />

      {/* ── Daily Overview ──────────────────────────────────────────────────── */}
      <DataMetricsSection
        symptoms={symptoms7d}
        labs={allLabs}
        isLoadingSymptoms={isLoadingSymptoms}
        isLoadingLabs={isLoadingLabs}
      />

      {/* ── Weekly Trends + Quick Actions ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <WeeklyTrendsSection
          symptoms={symptoms7d}
          isLoading={isLoadingSymptoms}
          className="lg:col-span-4"
        />
        <QuickActionsSection className="lg:col-span-3" />
      </div>
    </div>
  );
}
