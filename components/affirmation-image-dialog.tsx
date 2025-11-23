'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AffirmationImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  affirmation: string;
}

export function AffirmationImageDialog({
  open,
  onOpenChange,
  imageUrl,
  affirmation,
}: AffirmationImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='w-[90vw] max-w-[90vw] sm:max-w-5xl sm:w-full overflow-hidden border-none bg-transparent p-0 shadow-none'
        showCloseButton={false}
      >
        <DialogTitle className='sr-only'>Affirmation image preview</DialogTitle>
        <div className='relative flex items-center justify-center'>
          <DialogClose asChild>
            <button
              type='button'
              className={cn(
                'absolute top-1 right-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-lg transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 hover:cursor-pointer'
              )}
              aria-label='Close dialog'
            >
              <X className='h-4 w-4 text-black' />
            </button>
          </DialogClose>
          <img
            src={imageUrl}
            alt='Affirmation visualization'
            className='max-h-[90vh] rounded-lg object-cover shadow-2xl'
          />
          <div className='absolute bottom-0 w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 text-center text-white'>
            <p className='text-lg font-medium tracking-wide'>{affirmation}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
