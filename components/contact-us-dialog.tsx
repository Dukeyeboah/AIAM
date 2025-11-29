'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/providers/auth-provider';
import { Loader2, Mail, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContactUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactUsDialog({ open, onOpenChange }: ContactUsDialogProps) {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter your message or feedback.',
        variant: 'destructive',
      });
      return;
    }

    if (!user || !profile) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to send us a message.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: profile.email,
          userName: profile.displayName,
          subject: subject.trim() || 'Feedback from aiam user',
          message: message.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }

      toast({
        title: 'Message sent! ✨',
        description:
          'Thank you for your feedback. We appreciate you taking the time to share your thoughts with us.',
      });

      // Reset form
      setSubject('');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('[ContactUsDialog] Failed to send message', error);
      toast({
        title: 'Failed to send message',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to send your message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-lg sm:w-full flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='text-2xl flex items-center gap-2'>
            <Mail className='h-5 w-5' />
            Contact Us
          </DialogTitle>
          <DialogDescription className='text-base pt-2'>
            We'd love to hear from you! Share your feedback, suggestions, or
            questions.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='flex-1 pr-4 overflow-y-auto'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='subject'>Subject (optional)</Label>
              <Input
                id='subject'
                placeholder='e.g., Feature request, Bug report, General feedback'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='message'>
                Your Message <span className='text-destructive'>*</span>
              </Label>
              <Textarea
                id='message'
                placeholder="Tell us what you think! What do you love about aiam? What features would you like to see? Any issues you've encountered? We read every message and value your input."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={submitting}
                rows={8}
                className='resize-none'
              />
              <p className='text-xs text-muted-foreground'>
                Your feedback helps us improve aiam and create a better
                experience for everyone. Thank you for being part of our
                community! 🙏
              </p>
            </div>

            <div className='bg-muted/50 rounded-lg p-4 space-y-2'>
              <p className='text-sm font-semibold'>What we'd love to hear:</p>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside'>
                <li>What features do you enjoy most?</li>
                <li>What new features would you like to see?</li>
                <li>Any issues or bugs you've encountered?</li>
                <li>Suggestions for improving your experience</li>
                <li>General feedback about the app</li>
              </ul>
            </div>

            <div className='flex justify-end gap-3 pt-4 border-t'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={submitting || !message.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4 mr-2' />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
