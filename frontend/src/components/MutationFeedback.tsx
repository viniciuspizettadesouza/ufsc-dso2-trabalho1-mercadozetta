export type MutationFeedback = {
  type: 'success' | 'error';
  message: string;
} | null;

export function MutationFeedbackMessage({
  feedback,
  id,
  className = '',
  variant = 'inline',
}: {
  feedback: MutationFeedback;
  id?: string;
  className?: string;
  variant?: 'inline' | 'surface';
}) {
  if (!feedback) return null;

  const stateClass =
    feedback.type === 'error'
      ? variant === 'surface'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'text-red-700'
      : variant === 'surface'
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'text-green-700';
  const variantClass =
    variant === 'surface'
      ? 'rounded-surface border p-3 font-bold'
      : 'font-bold';

  return (
    <p
      id={id}
      className={`${variantClass} ${stateClass} ${className}`.trim()}
      role={feedback.type === 'error' ? 'alert' : 'status'}
    >
      {feedback.message}
    </p>
  );
}
