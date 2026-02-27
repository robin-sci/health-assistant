import { createFileRoute } from '@tanstack/react-router';
import { FileText, AlertCircle } from 'lucide-react';
import { useUsers } from '@/hooks/api/use-users';
import { useDocuments } from '@/hooks/api/use-documents';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';

export const Route = createFileRoute('/_authenticated/documents')({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { data: usersData } = useUsers({ limit: 1 });
  const userId = usersData?.items?.[0]?.id ?? '';

  const {
    data: documents = [],
    isLoading,
    isError,
    error,
  } = useDocuments(userId);

  return (
    <div className="min-h-screen bg-black p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="h-5 w-5 text-zinc-400" />
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Medical Documents
          </h1>
        </div>
        <p className="text-sm text-zinc-500 ml-8">
          Upload blood tests and medical documents for AI analysis
        </p>
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="flex items-center gap-2 mb-6 p-3 rounded-md
            bg-red-950/30 border border-red-900/50 text-red-400 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {error instanceof Error
              ? error.message
              : 'Failed to load documents'}
          </span>
        </div>
      )}

      {/* Two-column layout: upload (1/3) | list (2/3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload form */}
        <div className="md:col-span-1">
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-white">
                Upload Document
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                PDF, JPG, PNG, TIFF up to 50 MB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload userId={userId} />
            </CardContent>
          </Card>
        </div>

        {/* Document list */}
        <div className="md:col-span-2">
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-white">
                Your Documents
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                {documents.length} document
                {documents.length !== 1 ? 's' : ''} uploaded
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DocumentList
                documents={documents}
                isLoading={isLoading}
                userId={userId}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
