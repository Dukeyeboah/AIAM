'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AboutAiamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutAiamDialog({ open, onOpenChange }: AboutAiamDialogProps) {
  const [scienceOpen, setScienceOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[90vw] max-w-[90vw] sm:max-w-3xl sm:w-full max-h-[85vh] px-8'>
        <DialogHeader>
          <DialogTitle className='text-2xl'>About aiam</DialogTitle>
          <DialogDescription className='text-base'>
            Conscious Technology for Subconscious Reprogramming
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className='max-h-[65vh] px-4'>
          <div className='space-y-6 text-sm leading-relaxed'>
            <div className='space-y-4'>
              <p>
                aiam is a conscious technology designed to help you reprogram
                your subconscious mind and align with your highest potential —
                through the creative use of AI, affirmations, visualization, and
                sound.
              </p>
              <p>
                The words <strong>"I am"</strong> are the most powerful words
                you can ever speak — because whatever follows them becomes the
                blueprint for your reality. Your subconscious mind runs over 95%
                of your daily life, silently shaping your thoughts, emotions,
                habits, and outcomes. When you consciously choose the words that
                define you, you begin to rewrite the code of your inner
                programming — and transform the outer world that reflects it.
              </p>
            </div>

            <div className='space-y-3'>
              <h3 className='font-semibold text-base text-foreground'>
                AIAM uses the power of artificial intelligence to amplify your
                creative intelligence. It helps you:
              </h3>
              <ul className='list-disc list-inside space-y-2 ml-2'>
                <li>Generate affirmations tuned to your goals and emotions</li>
                <li>
                  Visualize your desired reality through personalized images
                </li>
                <li>
                  Program your subconscious more effectively by hearing
                  affirmations in your own voice
                </li>
                <li>Feel, see, and believe in your future self — now</li>
              </ul>
            </div>

            <p>
              Through consistent repetition and emotional conviction, these
              affirmations begin to retrain your subconscious, harmonizing your
              internal vibration with the life you wish to create. As modern
              science shows — through the works of Dr. Joe Dispenza, Bruce
              Lipton, and others — your thoughts and feelings are signals that
              influence both your biology and your reality. By changing your
              internal frequency, you attract experiences, people, and
              opportunities that match your new state of being.
            </p>

            <p className='font-semibold text-foreground'>
              This is AI for awakening, not automation — technology that reminds
              us of our divine creative power.
            </p>

            <p>
              You are not a byproduct of your past. You are the author of your
              present moment and the designer of your future reality.
            </p>

            <p className='text-base font-semibold text-foreground'>
              Welcome to aiam — where "I am" becomes "AI am."
            </p>
            <p>
              Let's reprogram your mind, rewrite your code, and recreate your
              world.
            </p>

            <Collapsible
              open={scienceOpen}
              onOpenChange={setScienceOpen}
              className='mx-2'
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant='ghost'
                  className='w-full justify-between text-sm font-medium cursor-pointer mb-4'
                >
                  <span>The Science Behind It</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      scienceOpen && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className='space-y-4 pt-4 border-t'>
                <p>
                  The subconscious mind is the operating system of human
                  reality. Neuroscience shows that over 95% of our actions and
                  reactions are governed by subconscious programming stored from
                  childhood and emotional experience.
                </p>
                <p>
                  Epigenetics, as explained by Dr. Bruce Lipton, reveals that
                  our beliefs and emotions directly influence gene expression
                  and cellular behavior. Meanwhile, neuroscience demonstrates
                  through brain imaging that thoughts and feelings create
                  measurable changes in the body's electromagnetic field and
                  brainwave states.
                </p>
                <p>
                  When we enter theta brainwave states — such as during early
                  morning or before sleep — the subconscious becomes highly
                  receptive to new information. This is why practicing
                  affirmations and visualizations during these times deeply
                  imprints new self-identity patterns.
                </p>
                <p>
                  Teachers like Neville Goddard and Napoleon Hill called this
                  "living in the feeling of the wish fulfilled." When combined
                  with emotional energy, words and imagery act as vibrational
                  codes, impressing the subconscious and attracting matching
                  experiences in the external world.
                </p>
                <p className='pb-4'>
                  aiam merges this timeless wisdom with modern AI — allowing
                  users to create custom affirmations, visualize their future
                  selves, and hear those affirmations spoken in their own voice.
                  It is a tool for self-directed evolution, guiding users to
                  embody their higher state of being through focused
                  imagination, emotion, and repetition.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
