import { useRef } from 'react';
import { Camera, Users, X } from 'lucide-react';
import { prepareChatAvatarFromFile } from '@/services/chat/avatar';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';
import { cn } from '@/utils';

interface ChatAvatarEditorProps {
  value?: string;
  onChange: (next: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatAvatarEditor({
  value = '',
  onChange,
  onError,
  disabled,
  className,
}: ChatAvatarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showAvatar = isDisplayableAvatarSrc(value);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await prepareChatAvatarFromFile(file);
      onChange(dataUrl);
      onError?.('');
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Не удалось загрузить иконку');
    }
  };

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={cn(
          'flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-elevated focus-ring',
          'hover:bg-surface-hover',
        )}
        aria-label="Изменить иконку чата"
      >
        {showAvatar ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users className="h-7 w-7 text-text-muted" aria-hidden />
        )}
        <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-0.5">
          <Camera className="h-3.5 w-3.5 text-white" aria-hidden />
        </span>
      </button>
      {showAvatar && (
        <button
          type="button"
          aria-label="Убрать иконку"
          disabled={disabled}
          onClick={() => {
            onChange('');
            onError?.('');
          }}
          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-secondary focus-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={(e) => {
          void handlePick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
