import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const DEFAULT_MAX_FILES = 5;

export interface PendingAssignmentFile {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  uploading?: boolean;
  error?: string;
}

interface AssignmentFilePickerProps {
  label: string;
  hint?: string;
  files: PendingAssignmentFile[];
  onFilesSelected: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  error?: string;
  maxFiles?: number;
}

export function AssignmentFilePicker({
  label,
  hint,
  files,
  onFilesSelected,
  onRemove,
  disabled,
  error,
  maxFiles = DEFAULT_MAX_FILES,
}: AssignmentFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = files.length < maxFiles;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label">{label}</span>
        {canAdd && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" aria-hidden />
            Прикрепить
          </Button>
        )}
      </div>
      {hint && <p className="text-caption text-text-muted">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        disabled={disabled || !canAdd}
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{file.filename}</span>
              <div className="flex shrink-0 items-center gap-2">
                {file.uploading && <span className="text-caption text-text-muted">Загрузка…</span>}
                {file.error && <span className="text-caption text-danger">{file.error}</span>}
                {!file.uploading && (
                  <button
                    type="button"
                    onClick={() => onRemove(file.id)}
                    className="min-h-11 min-w-11 rounded p-2 text-text-muted hover:text-danger focus-ring"
                    aria-label={`Удалить ${file.filename}`}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
