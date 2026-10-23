import type { ButtonHTMLAttributes } from 'react';

// Primary is the screen's next step (solid ink); secondary is everything else (outlined).
// Only one control should be primary at a time. Taller on touch screens for a 44px target.
export type ButtonVariant = 'primary' | 'secondary';

const BASE =
  'pressable h-8 pointer-coarse:h-11 px-3 rounded-md border text-[13px] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-70';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink border-ink enabled:hover:opacity-90',
  secondary: 'bg-bg text-ink border-line enabled:hover:bg-hover',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
