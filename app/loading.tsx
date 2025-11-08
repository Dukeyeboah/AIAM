import Image from 'next/image';

export default function Loading() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-background'>
      <Image
        src='/images/aiam_textlogo_blk.png'
        alt='AiAm'
        width={320}
        height={120}
        className='h-12 w-auto animate-float'
        priority
      />
    </main>
  );
}
