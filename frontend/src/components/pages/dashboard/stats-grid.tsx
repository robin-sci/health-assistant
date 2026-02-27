import {
  HeartPulse,
  FlaskConical,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { StatsCard } from './stats-card';
import { cn } from '@/lib/utils';

export interface HealthStatsGridProps {
  symptomsThisWeek: number;
  totalLabs: number;
  totalDocuments: number;
  totalChatSessions: number;
  className?: string;
}

// Keep old props type for backwards compat (not used after dashboard rewrite)
export interface StatsGridProps extends HealthStatsGridProps {
  className?: string;
}

export function StatsGrid({
  symptomsThisWeek,
  totalLabs,
  totalDocuments,
  totalChatSessions,
  className,
}: HealthStatsGridProps) {
  const statCards = [
    {
      title: 'Symptoms This Week',
      value: symptomsThisWeek,
      description: 'Logged in the last 7 days',
      icon: HeartPulse,
    },
    {
      title: 'Lab Results',
      value: totalLabs,
      description: 'Blood test records',
      icon: FlaskConical,
    },
    {
      title: 'Documents',
      value: totalDocuments,
      description: 'Medical files uploaded',
      icon: FileText,
    },
    {
      title: 'Chat Sessions',
      value: totalChatSessions,
      description: 'AI health conversations',
      icon: MessageSquare,
    },
  ];

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {statCards.map((stat) => (
        <StatsCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
        />
      ))}
    </div>
  );
}
