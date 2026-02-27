import { Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MedicalDocument } from '@/lib/api/types';
import { useDeleteDocument } from '@/hooks/api/use-documents';
import { DocumentStatusBadge } from './DocumentStatusBadge';

interface DocumentListProps {
  documents: MedicalDocument[];
  isLoading: boolean;
  userId: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  lab_report: 'Lab Report',
  prescription: 'Prescription',
  imaging: 'Imaging',
  other: 'Other',
};

function formatDocumentType(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DocumentList({
  documents,
  isLoading,
  userId,
}: DocumentListProps) {
  const deleteDocument = useDeleteDocument();

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    await deleteDocument.mutateAsync({ id, userId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <div
            className={cn(
              'h-4 w-4 animate-spin rounded-full',
              'border border-zinc-700 border-t-zinc-400'
            )}
          />
          Loading documents…
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center',
          'py-16 px-4 text-center'
        )}
      >
        <FileText className="h-10 w-10 text-zinc-800 mb-3" />
        <p className="text-sm text-zinc-400 font-medium">
          No documents uploaded yet
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          Upload your first document above.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-900 hover:bg-transparent">
            <TableHead className="text-zinc-500 text-xs font-medium">
              Title
            </TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium">
              Type
            </TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium hidden sm:table-cell">
              Date
            </TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium">
              Status
            </TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium hidden md:table-cell">
              Uploaded
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const isDeleting =
              deleteDocument.isPending &&
              deleteDocument.variables?.id === doc.id;

            return (
              <TableRow
                key={doc.id}
                className={cn(
                  'border-zinc-900 hover:bg-zinc-900/30 transition-colors',
                  isDeleting && 'opacity-50 pointer-events-none'
                )}
              >
                <TableCell className="text-white text-sm font-medium max-w-[160px] truncate">
                  {doc.title}
                </TableCell>
                <TableCell className="text-zinc-400 text-sm whitespace-nowrap">
                  {formatDocumentType(doc.document_type)}
                </TableCell>
                <TableCell className="text-zinc-400 text-sm whitespace-nowrap hidden sm:table-cell">
                  {formatDate(doc.document_date)}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={doc.status} />
                </TableCell>
                <TableCell className="text-zinc-500 text-xs whitespace-nowrap hidden md:table-cell">
                  {formatDate(doc.created_at)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isDeleting}
                    onClick={() => handleDelete(doc.id)}
                    className={cn(
                      'h-7 w-7 text-zinc-600',
                      'hover:text-red-400 hover:bg-transparent'
                    )}
                    aria-label={`Delete ${doc.title}`}
                  >
                    {isDeleting ? (
                      <div
                        className={cn(
                          'h-3 w-3 animate-spin rounded-full',
                          'border border-zinc-700 border-t-zinc-400'
                        )}
                      />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
