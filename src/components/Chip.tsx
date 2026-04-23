type Variant = 'frequent' | 'recent';

interface Props {
  emoji?: string;
  label: string;
  variant?: Variant;
  onClick?: () => void;
}

export function Chip({ emoji, label, variant = 'frequent', onClick }: Props) {
  const bg = variant === 'frequent' ? 'bg-green-50' : 'bg-gray-100';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs ${bg} text-gray-800 active:opacity-60 mr-2 mb-2`}
    >
      {emoji && <span>{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}
