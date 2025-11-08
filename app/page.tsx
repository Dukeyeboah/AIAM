import { CategoryGrid } from '@/components/category-grid';
import { BackgroundAnimation } from '@/components/background-animation';
import { SplashScreen } from '@/components/splash-screen';

export default function Home() {
  return (
    <SplashScreen duration={5000}>
      <main className='relative min-h-screen bg-gray-80 overflow-hidden'>
        <BackgroundAnimation />

        <div className='relative z-10 container mx-auto px-1 py-4'>
          <header className='bg-transparent backdrop-blur-sm pt-3 fixed top-0 left-6 right-6 z-250 text-center mb-12 space-y-4 flex flex-col items-centerjustify-center'>
            <div className='flex flex-row items-centerjustify-center'>
              {/* <img src='/images/aiam_logo_blk.png' alt='AiAm' className='h-4' /> */}
              <img
                src='/images/aiam_textlogo_blk.png'
                alt='AiAm wordmark'
                // className='w-24 animate-float'
                className='h-6'
              />
            </div>
            <div className='flex flex-col items-center justify-center'>
              {/* <img
                src='/images/aiam_textlogo_blk.png'
                alt='AiAm wordmark'
                // className='w-24 animate-float'
                className='w-20'
              /> */}
            </div>
            {/* <p className='text-lg md:text-lg text-muted-foreground max-w-2xl mx-auto text-blue-800 text-pretty'>
              Generate personalized affirmations to nurture your mind, body, and
              soul
            </p> */}
          </header>
          <div className='flex flex-col items-center justify-center pt-12 pb-8'>
            {/* <img
                src='/images/aiam_textlogo_blk.png'
                alt='AiAm wordmark'
                // className='w-24 animate-float'
                className='w-20'
              /> */}
            <p className='text-lg md:text-lg text-muted-foreground max-w-2xl mx-auto text-blue-800 text-pretty'>
              Generate personalized affirmations to nurture your mind, body, and
              soul
            </p>
          </div>

          <CategoryGrid />
        </div>
      </main>
    </SplashScreen>
  );
}
