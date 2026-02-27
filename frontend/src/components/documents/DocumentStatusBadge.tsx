import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/lib/api/types';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
}

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning';

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  className?: string;
}

const STATUS_CONFIG: Record<DocumentStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    className: 'text-zinc-400 border-zinc-700 bg-transparent',
  },
  parsing: {
    label: 'Parsing',
    variant: 'outline',
    className: 'text-blue-400 border-blue-800 bg-blue-950/40',
  },
  parsed: {
    label: 'Parsed',
    variant: 'outline',
    className: 'text-blue-300 border-blue-700 bg-blue-900/30',
  },
  extracting: {
    label: 'Extracting',
    variant: 'warning',
  },
  completed: {
    label: 'Complete',
    variant: 'success',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
  },
};

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
