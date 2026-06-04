'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * Global toast surface. Mount once near the root layout. Token-driven via
 * `toastOptions.classNames` so it inherits the sober-luxe palette.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border/60 bg-off-white text-fg shadow-overlay font-sans',
          title: 'font-medium',
          description: 'text-muted',
          actionButton: 'bg-gold text-charcoal rounded-md',
          cancelButton: 'bg-surface-container text-fg rounded-md',
          error: 'border-danger/40',
          success: 'border-success/40',
        },
      }}
      {...props}
    />
  );
}

export { toast };
