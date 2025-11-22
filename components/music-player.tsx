'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Menu,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { firebaseStorage } from '@/lib/firebase/client';
import { ref, getDownloadURL, listAll } from 'firebase/storage';

// Song names that match the app's vibe
const SONG_NAMES = [
  'Cosmic Flow',
  'Serene Mind',
  'Inner Peace',
  'Ethereal Dreams',
  'Zen Garden',
  'Meditation Waves',
  'Tranquil Space',
  'Sacred Silence',
  'Mindful Journey',
  'Harmony Within',
];

interface Song {
  name: string;
  url: string;
}

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [songs, setSongs] = useState<Song[]>([]);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSongIndexRef = useRef(0);

  // Listen for background music events
  useEffect(() => {
    const handleStartMusic = () => {
      if (songs.length > 0 && !isPlaying) {
        setIsPlaying(true);
        if (audioRef.current) {
          audioRef.current.play().catch((error) => {
            console.error(
              '[MusicPlayer] Failed to start background music',
              error
            );
          });
        }
      }
    };

    const handleStopMusic = () => {
      if (isPlaying) {
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    };

    window.addEventListener('start-background-music', handleStartMusic);
    window.addEventListener('stop-background-music', handleStopMusic);

    return () => {
      window.removeEventListener('start-background-music', handleStartMusic);
      window.removeEventListener('stop-background-music', handleStopMusic);
    };
  }, [songs.length, isPlaying]);

  // Load songs from Firebase Storage
  useEffect(() => {
    const loadSongs = async () => {
      setLoading(true);
      try {
        const musicRef = ref(firebaseStorage, 'music');
        const files = await listAll(musicRef);

        if (files.items.length === 0) {
          console.log('[MusicPlayer] No songs found in Firebase Storage');
          setLoading(false);
          return;
        }

        const songPromises = files.items.map(async (item, index) => {
          try {
            const url = await getDownloadURL(item);
            return {
              name: SONG_NAMES[index] || `Track ${index + 1}`,
              url,
            };
          } catch (err) {
            console.error(
              `[MusicPlayer] Failed to get URL for ${item.name}:`,
              err
            );
            return null;
          }
        });

        const loadedSongs = (await Promise.all(songPromises)).filter(
          (song): song is Song => song !== null
        );
        setSongs(loadedSongs);
      } catch (error) {
        console.error('[MusicPlayer] Failed to load songs:', error);
        // If no songs found or permission denied, that's okay - user can upload them
        // The player will still show but be disabled
      } finally {
        setLoading(false);
      }
    };

    void loadSongs();
  }, []);

  // Update ref when currentSongIndex changes
  useEffect(() => {
    currentSongIndexRef.current = currentSongIndex;
  }, [currentSongIndex]);

  // Initialize audio element
  useEffect(() => {
    if (songs.length === 0) return;

    const audio = new Audio();
    audio.volume = isMuted ? 0 : volume;
    audio.src = songs[currentSongIndex]?.url || '';

    const handleEnded = () => {
      // Auto-play next song when current ends
      if (songs.length > 0) {
        const nextIndex = (currentSongIndexRef.current + 1) % songs.length;
        setCurrentSongIndex(nextIndex);
        setIsPlaying(true);
      }
    };

    const handleLoadedData = () => {
      if (isPlaying) {
        void audio.play().catch((err) => {
          console.error('[MusicPlayer] Play failed:', err);
        });
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadeddata', handleLoadedData);

    audioRef.current = audio;

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.pause();
      audio.src = '';
    };
  }, [songs, currentSongIndex, isPlaying, isMuted, volume]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Update audio playback state
  useEffect(() => {
    if (!audioRef.current || songs.length === 0) return;

    if (isPlaying) {
      void audioRef.current.play().catch((err) => {
        console.error('[MusicPlayer] Play failed:', err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, songs.length]);

  const handlePlayPause = () => {
    if (songs.length === 0) {
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % songs.length;
    setCurrentSongIndex(nextIndex);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (songs.length === 0) return;
    const prevIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    setCurrentSongIndex(prevIndex);
    setIsPlaying(true);
  };

  const handleSelectSong = (index: number) => {
    setCurrentSongIndex(index);
    setIsPlaying(true);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100; // Convert 0-100 to 0-1
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  const handleVolumeIconClick = () => {
    setVolumePopoverOpen(!volumePopoverOpen);
  };

  // Always show the player, even if no songs are loaded yet
  const currentSong = songs[currentSongIndex];

  return (
    <div className='flex items-center gap-2'>
      {/* Compact view when not expanded */}
      {!isExpanded && (
        <Button
          variant='ghost'
          size='icon'
          className='h-10 w-10 rounded-full'
          onClick={() => setIsExpanded(true)}
          title='Music Player'
        >
          <Music className='h-5 w-5' />
        </Button>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <div className='flex items-center gap-2 bg-muted/50 rounded-full px-3 py-2 border border-border/50'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={handlePrevious}
            disabled={songs.length === 0}
            title='Previous'
          >
            <SkipBack className='h-4 w-4' />
          </Button>

          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={handlePlayPause}
            disabled={songs.length === 0}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className='h-4 w-4' />
            ) : (
              <Play className='h-4 w-4' />
            )}
          </Button>

          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={handleNext}
            disabled={songs.length === 0}
            title='Next'
          >
            <SkipForward className='h-4 w-4' />
          </Button>

          <Popover open={volumePopoverOpen} onOpenChange={setVolumePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={handleVolumeIconClick}
                title={`Volume: ${Math.round(isMuted ? 0 : volume * 100)}%`}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className='h-4 w-4' />
                ) : (
                  <Volume2 className='h-4 w-4' />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent side='top' align='end' className='w-auto p-3'>
              <div className='flex flex-col items-center gap-3'>
                <span className='text-xs text-muted-foreground'>
                  {Math.round(isMuted ? 0 : volume * 100)}%
                </span>
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  onValueChange={handleVolumeChange}
                  min={0}
                  max={100}
                  step={1}
                  orientation='vertical'
                  className='h-32'
                  title={`Volume: ${Math.round(isMuted ? 0 : volume * 100)}%`}
                />
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 text-xs'
                  onClick={toggleMute}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                title='Song List'
              >
                <Menu className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              className='w-64 max-h-[280px] overflow-y-auto'
            >
              <DropdownMenuLabel>
                {currentSong
                  ? `Now Playing: ${currentSong.name}`
                  : songs.length === 0
                  ? 'No songs available'
                  : 'Select a Song'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {songs.length === 0 ? (
                <div className='px-2 py-4 text-sm text-muted-foreground text-center'>
                  Upload songs to Firebase Storage
                  <br />
                  <span className='text-xs'>Folder: music/</span>
                </div>
              ) : (
                songs.map((song, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => handleSelectSong(index)}
                    className={index === currentSongIndex ? 'bg-accent' : ''}
                  >
                    <div className='flex items-center gap-2 w-full'>
                      {index === currentSongIndex && isPlaying && (
                        <Music className='h-3 w-3 animate-pulse' />
                      )}
                      <span className='flex-1'>{song.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={() => setIsExpanded(false)}
            title='Collapse'
          >
            <Music className='h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  );
}
