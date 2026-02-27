import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUploadDocument } from '@/hooks/api/use-documents';

interface DocumentUploadProps {
  userId: string;
}

const DOCUMENT_TYPES = [
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'other', label: 'Other' },
] as const;

export function DocumentUpload({ userId }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('lab_report');
  const [documentDate, setDocumentDate] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDocument = useUploadDocument();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim() || !userId) return;

    await uploadDocument.mutateAsync({
      userId,
      file,
      meta: {
        title: title.trim(),
        document_type: documentType,
        ...(documentDate ? { document_date: documentDate } : {}),
      },
    });

    // Reset form on success
    setFile(null);
    setTitle('');
    setDocumentType('lab_report');
    setDocumentDate('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-5 text-center',
          'cursor-pointer transition-colors duration-200',
          isDragging
            ? 'border-zinc-500 bg-zinc-800/50'
            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30',
          file && 'border-zinc-700 bg-zinc-900/20'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-300 truncate max-w-[160px]">
              {file.name}
            </span>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={clearFile}
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-6 w-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">
              Drop a file or click to browse
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              PDF, JPG, PNG, TIFF, WEBP
            </p>
          </>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="doc-title" className="text-xs text-zinc-400">
          Title <span className="text-zinc-600">*</span>
        </Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Blood test January 2024"
          required
          className={cn(
            'bg-zinc-900 border-zinc-800 text-white',
            'placeholder:text-zinc-600',
            'focus-visible:ring-zinc-700 focus-visible:ring-1'
          )}
        />
      </div>

      {/* Document type */}
      <div className="space-y-1.5">
        <Label htmlFor="doc-type" className="text-xs text-zinc-400">
          Document Type
        </Label>
        <select
          id="doc-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className={cn(
            'w-full rounded-md border border-zinc-800',
            'bg-zinc-900 px-3 py-2 text-sm text-white',
            'focus:outline-none focus:ring-1 focus:ring-zinc-700'
          )}
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Document date */}
      <div className="space-y-1.5">
        <Label htmlFor="doc-date" className="text-xs text-zinc-400">
          Document Date <span className="text-zinc-600">(optional)</span>
        </Label>
        <input
          id="doc-date"
          type="date"
          value={documentDate}
          onChange={(e) => setDocumentDate(e.target.value)}
          className={cn(
            'w-full rounded-md border border-zinc-800',
            'bg-zinc-900 px-3 py-2 text-sm text-white',
            'focus:outline-none focus:ring-1 focus:ring-zinc-700',
            '[color-scheme:dark]'
          )}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!file || !title.trim() || uploadDocument.isPending}
        className={cn(
          'w-full bg-zinc-800 hover:bg-zinc-700',
          'text-white border border-zinc-700'
        )}
      >
        {uploadDocument.isPending ? (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'h-3.5 w-3.5 animate-spin rounded-full',
                'border border-zinc-500 border-t-white'
              )}
            />
            Uploading…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </span>
        )}
      </Button>
    </form>
  );
}
