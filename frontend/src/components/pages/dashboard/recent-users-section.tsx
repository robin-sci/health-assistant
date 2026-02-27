import { Link } from '@tanstack/react-router';
import { Activity, FileUp, MessageSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants/routes';

export interface QuickActionsSectionProps {
  className?: string;
}

// Keep old interface exported for backwards compat
export interface RecentUsersSectionProps extends QuickActionsSectionProps {
  users?: unknown[];
  totalUsersCount?: number;
  isLoading?: boolean;
}

const QUICK_ACTIONS = [
  {
    title: 'Log Symptom',
    description: 'Record how you are feeling today with severity and notes',
    icon: Activity,
    href: ROUTES.symptoms,
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10',
    accentBorder: 'border-emerald-400/20',
  },
  {
    title: 'Upload Document',
    description: 'Upload blood test PDFs or medical reports for AI extraction',
    icon: FileUp,
    href: ROUTES.documents,
    accent: 'text-blue-400',
    accentBg: 'bg-blue-400/10',
    accentBorder: 'border-blue-400/20',
  },
  {
    title: 'Start Chat',
    description: 'Ask your AI health assistant about your data and symptoms',
    icon: MessageSquare,
    href: ROUTES.chat,
    accent: 'text-violet-400',
    accentBg: 'bg-violet-400/10',
    accentBorder: 'border-violet-400/20',
  },
] as const;

export function QuickActionsSection({ className }: QuickActionsSectionProps) {
  return (
    <div
      className={cn(
        'bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden',
        className
      )}
    >
      <div className="px-6 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-white">Quick Actions</h2>
        <p className="text-xs text-zinc-500 mt-1">Jump to a health task</p>
      </div>

      <div className="p-4 space-y-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.title}
            to={action.href}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg border',
              'border-zinc-800 hover:border-zinc-700',
              'bg-zinc-900/40 hover:bg-zinc-900/80',
              'transition-all duration-150 group'
            )}
          >
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                'border',
                action.accentBg,
                action.accentBorder
              )}
            >
              <action.icon className={cn('w-4 h-4', action.accent)} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                {action.title}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5 leading-snug">
                {action.description}
              </p>
            </div>

            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Alias so old import still resolves
export const RecentUsersSection = QuickActionsSection;
