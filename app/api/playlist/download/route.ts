import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export async function POST(req: Request) {
  try {
    const { userId, playlistId, voiceId, withMusic, withImages } =
      await req.json();

    if (!userId || !playlistId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get playlist
    const playlistDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('playlists')
      .doc(playlistId)
      .get();

    if (!playlistDoc.exists) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    const playlistData = playlistDoc.data();
    const affirmationIds = playlistData?.affirmationIds || [];

    if (affirmationIds.length === 0) {
      return NextResponse.json({ error: 'Playlist is empty' }, { status: 400 });
    }

    // Get all affirmations and check if they have cached audio
    const affirmationDocs = await Promise.all(
      affirmationIds.map((affId: string) =>
        adminDb
          .collection('users')
          .doc(userId)
          .collection('affirmations')
          .doc(affId)
          .get()
      )
    );

    const audioUrls: string[] = [];
    const missingAudio: string[] = [];

    for (let i = 0; i < affirmationDocs.length; i++) {
      const affDoc = affirmationDocs[i];
      if (!affDoc.exists) {
        missingAudio.push(affirmationIds[i]);
        continue;
      }

      const affData = affDoc.data();
      const audioUrlsMap = affData?.audioUrls || {};
      const audioUrl = audioUrlsMap[voiceId];

      if (!audioUrl) {
        missingAudio.push(affirmationIds[i]);
        continue;
      }

      // Resolve gs:// URLs to https URLs if needed
      let resolvedUrl = audioUrl;
      if (audioUrl.startsWith('gs://')) {
        try {
          const { admin } = await import('@/lib/firebase/admin');
          const path = audioUrl.replace(/^gs:\/\/[^/]+\//, '');
          const bucket = admin.storage().bucket();
          const file = bucket.file(path);
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
          });
          resolvedUrl = signedUrl;
        } catch (error) {
          console.error(
            `[playlist-download] Failed to resolve gs:// URL for ${affirmationIds[i]}`,
            error
          );
          missingAudio.push(affirmationIds[i]);
          continue;
        }
      }

      audioUrls.push(resolvedUrl);
    }

    if (missingAudio.length > 0) {
      return NextResponse.json(
        {
          error: 'Not all affirmations have cached audio',
          missingCount: missingAudio.length,
          totalCount: affirmationIds.length,
        },
        { status: 400 }
      );
    }

    // Fetch all audio files and combine them
    const audioBlobs: Blob[] = [];
    for (const url of audioUrls) {
      try {
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        const blob = await response.blob();
        audioBlobs.push(blob);
      } catch (error) {
        console.error('[playlist-download] Failed to fetch audio', error);
        return NextResponse.json(
          {
            error: 'Failed to fetch one or more audio files',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Get image URLs for video generation if needed
    const imageUrls: (string | null)[] = [];
    if (withImages) {
      for (let i = 0; i < affirmationDocs.length; i++) {
        const affDoc = affirmationDocs[i];
        if (!affDoc.exists) {
          imageUrls.push(null);
          continue;
        }
        const affData = affDoc.data();
        let imageUrl = affData?.imageUrl || null;

        // Resolve gs:// URLs to https URLs if needed
        if (imageUrl && imageUrl.startsWith('gs://')) {
          try {
            const { admin } = await import('@/lib/firebase/admin');
            const path = imageUrl.replace(/^gs:\/\/[^/]+\//, '');
            const bucket = admin.storage().bucket();
            const file = bucket.file(path);
            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + 15 * 60 * 1000,
            });
            imageUrl = signedUrl;
          } catch (error) {
            console.error(
              `[playlist-download] Failed to resolve image URL for ${affirmationIds[i]}`,
              error
            );
            imageUrl = null;
          }
        }
        imageUrls.push(imageUrl);
      }
    }

    // For video creation, use a simpler slideshow approach
    if (withImages) {
      try {
        // Check if all affirmations have images
        const missingImages = imageUrls.filter((url) => !url).length;
        if (missingImages > 0) {
          return NextResponse.json(
            {
              error: 'Not all affirmations have images',
              missingCount: missingImages,
              totalCount: affirmationIds.length,
            },
            { status: 400 }
          );
        }

        // Initialize FFmpeg
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        // Load FFmpeg core
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            'text/javascript'
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            'application/wasm'
          ),
        });

        // Fetch and write image files
        const imageFiles: string[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
          const imageUrl = imageUrls[i];
          if (!imageUrl) continue;

          try {
            const imageResponse = await fetch(imageUrl, {
              mode: 'cors',
              credentials: 'omit',
            });
            if (!imageResponse.ok) throw new Error('Failed to fetch image');
            const imageBlob = await imageResponse.blob();
            const imageArrayBuffer = await imageBlob.arrayBuffer();
            const imageFileName = `image_${i}.jpg`;
            await ffmpeg.writeFile(
              imageFileName,
              new Uint8Array(imageArrayBuffer)
            );
            imageFiles.push(imageFileName);
          } catch (error) {
            console.error(
              `[playlist-download] Failed to fetch image ${i}:`,
              error
            );
            throw error;
          }
        }

        // Fetch and write audio files
        const audioFiles: string[] = [];
        for (let i = 0; i < audioBlobs.length; i++) {
          const audioFileName = `audio_${i}.mp3`;
          await ffmpeg.writeFile(
            audioFileName,
            new Uint8Array(await audioBlobs[i].arrayBuffer())
          );
          audioFiles.push(audioFileName);
        }

        // Get music file if withMusic is also true
        let musicFileName: string | null = null;
        if (withMusic) {
          const { admin } = await import('@/lib/firebase/admin');
          const bucket = admin.storage().bucket();
          const [files] = await bucket.getFiles({
            prefix: 'music/',
            maxResults: 1,
          });

          if (files.length > 0) {
            const [musicBuffer] = await files[0].download();
            musicFileName = 'music.mp3';
            await ffmpeg.writeFile(musicFileName, new Uint8Array(musicBuffer));
          }
        }

        // Create filter complex for video: each image displayed for duration of its audio
        // Then mix audio with optional background music
        let filterComplex = '';
        const inputArgs: string[] = [];

        // Add image inputs - we'll use the audio duration to determine image display time
        for (let i = 0; i < imageFiles.length; i++) {
          inputArgs.push('-loop', '1', '-i', imageFiles[i]);
        }

        // Add audio inputs
        for (let i = 0; i < audioFiles.length; i++) {
          inputArgs.push('-i', audioFiles[i]);
        }

        // Add music input if available
        if (musicFileName) {
          inputArgs.push('-i', musicFileName);
        }

        // Build filter complex for video: each image displayed for duration of its corresponding audio
        // Simple approach: Scale images, prepare audio, create segments, concatenate
        const videoFilters: string[] = [];
        const audioInputOffset = imageFiles.length;

        // Scale and prepare each image
        for (let i = 0; i < imageFiles.length; i++) {
          videoFilters.push(
            `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[v${i}]`
          );
        }

        // Prepare audio streams
        for (let i = 0; i < audioFiles.length; i++) {
          videoFilters.push(
            `[${audioInputOffset + i}:a]asetpts=PTS-STARTPTS[a${i}]`
          );
        }

        // Create video segments: each image shown for duration of its audio
        // Simple approach: Use shortest duration to match image to audio, then combine video+audio
        const segmentFilters: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          // Each segment: image (looping) + audio, matched by shortest duration
          // The image will be trimmed to match audio duration automatically
          segmentFilters.push(
            `[v${i}][a${i}]concat=n=1:v=1:a=1:unsafe=1[seg${i}]`
          );
        }

        // Concatenate all video segments
        const videoConcatInputs = imageFiles
          .map((_, i) => `[seg${i}]`)
          .join('');
        segmentFilters.push(
          `${videoConcatInputs}concat=n=${imageFiles.length}:v=1:a=1[outv]`
        );

        videoFilters.push(...segmentFilters);

        // Combine all video filters
        filterComplex = videoFilters.join(';');

        // Execute FFmpeg to create video (no music mixing - that's done client-side)
        const ffmpegArgs = [
          ...inputArgs,
          '-filter_complex',
          filterComplex,
          '-map',
          '[outv]',
          '-c:v',
          'libx264',
          '-preset',
          'fast', // Use fast preset for quicker processing
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-shortest', // Critical: stop when shortest input ends
          '-movflags',
          '+faststart',
          'output.mp4',
        ];

        console.log('[playlist-download] Creating video with FFmpeg...');
        console.log('[playlist-download] Filter complex:', filterComplex);
        console.log('[playlist-download] Input args count:', inputArgs.length);

        try {
          await ffmpeg.exec(ffmpegArgs);
        } catch (ffmpegError) {
          console.error(
            '[playlist-download] FFmpeg execution error:',
            ffmpegError
          );
          // Try to get FFmpeg logs if available
          const errorMessage =
            ffmpegError instanceof Error
              ? ffmpegError.message
              : String(ffmpegError);
          throw new Error(`FFmpeg failed: ${errorMessage}`);
        }

        // Read the output file
        const outputData = await ffmpeg.readFile('output.mp4');
        const outputBlob =
          outputData instanceof Uint8Array
            ? outputData
            : new Uint8Array(await (outputData as Blob).arrayBuffer());

        // Clean up
        for (const file of [...imageFiles, ...audioFiles]) {
          await ffmpeg.deleteFile(file).catch(() => {});
        }
        if (musicFileName) {
          await ffmpeg.deleteFile(musicFileName).catch(() => {});
        }
        await ffmpeg.deleteFile('output.mp4').catch(() => {});

        return new NextResponse(outputBlob, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(
              (playlistData?.name || 'playlist').replace(/[^a-z0-9]/gi, '_')
            )}_${voiceId}_video.mp4"`,
          },
        });
      } catch (error) {
        console.error('[playlist-download] Video creation failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error('[playlist-download] Full error details:', {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          {
            error: 'Failed to create video',
            details: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    // If withMusic is true, use ffmpeg to mix background music
    if (withMusic) {
      try {
        // First, combine all affirmation audio files using FFmpeg for proper concatenation
        const ffmpeg = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        // Load FFmpeg core
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            'text/javascript'
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            'application/wasm'
          ),
        });

        // Write audio files to FFmpeg's virtual file system
        const audioFileNames: string[] = [];
        for (let i = 0; i < audioBlobs.length; i++) {
          const fileName = `audio_${i}.mp3`;
          await ffmpeg.writeFile(
            fileName,
            new Uint8Array(await audioBlobs[i].arrayBuffer())
          );
          audioFileNames.push(fileName);
        }

        // Concatenate audio files properly
        const concatInputs = audioFileNames.map((_, i) => `[${i}:a]`).join('');
        const filterComplex = `${concatInputs}concat=n=${audioFileNames.length}:v=0:a=1[affirmations]`;

        // Get a music file from Firebase Storage
        const { admin } = await import('@/lib/firebase/admin');
        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({
          prefix: 'music/',
          maxResults: 1,
        });

        if (files.length === 0) {
          console.log(
            '[playlist-download] No music files found, returning affirmations without music'
          );
          // Concatenate without music
          await ffmpeg.exec([
            ...audioFileNames.flatMap((name) => ['-i', name]),
            '-filter_complex',
            filterComplex,
            '-map',
            '[affirmations]',
            '-c:a',
            'libmp3lame',
            '-b:a',
            '128k',
            'output.mp3',
          ]);

          const outputData = await ffmpeg.readFile('output.mp3');
          const outputBlob =
            outputData instanceof Uint8Array
              ? outputData
              : new Uint8Array(await (outputData as Blob).arrayBuffer());

          // Clean up
          for (const file of audioFileNames) {
            await ffmpeg.deleteFile(file).catch(() => {});
          }
          await ffmpeg.deleteFile('output.mp3').catch(() => {});

          return new NextResponse(outputBlob, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(
                (playlistData?.name || 'playlist').replace(/[^a-z0-9]/gi, '_')
              )}_${voiceId}.mp3"`,
            },
          });
        }

        // Download music file
        const [musicBuffer] = await files[0].download();
        await ffmpeg.writeFile('music.mp3', new Uint8Array(musicBuffer));

        // Mix audio: affirmations at 100% volume, music at 20% volume
        const musicInputIndex = audioFileNames.length;
        await ffmpeg.exec([
          ...audioFileNames.flatMap((name) => ['-i', name]),
          '-i',
          'music.mp3',
          '-filter_complex',
          `${filterComplex};[affirmations]volume=1.0[aff];[${musicInputIndex}:a]volume=0.2,aloop=loop=-1:size=2e+09[music];[aff][music]amix=inputs=2:duration=first:dropout_transition=0[outa]`,
          '-map',
          '[outa]',
          '-c:a',
          'libmp3lame',
          '-b:a',
          '128k',
          '-shortest',
          'output.mp3',
        ]);

        // Read the output file
        const outputData = await ffmpeg.readFile('output.mp3');
        const outputBlob =
          outputData instanceof Uint8Array
            ? outputData
            : new Uint8Array(await (outputData as Blob).arrayBuffer());

        // Clean up
        for (const file of audioFileNames) {
          await ffmpeg.deleteFile(file).catch(() => {});
        }
        await ffmpeg.deleteFile('music.mp3').catch(() => {});
        await ffmpeg.deleteFile('output.mp3').catch(() => {});

        return new NextResponse(outputBlob, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(
              (playlistData?.name || 'playlist').replace(/[^a-z0-9]/gi, '_')
            )}_${voiceId}_with_music.mp3"`,
          },
        });
      } catch (error) {
        console.error('[playlist-download] Music mixing failed:', error);
        // Fall back to simple concatenation without music
        const totalSize = audioBlobs.reduce((sum, blob) => sum + blob.size, 0);
        const combinedArray = new Uint8Array(totalSize);
        let offset = 0;

        for (const blob of audioBlobs) {
          const arrayBuffer = await blob.arrayBuffer();
          combinedArray.set(new Uint8Array(arrayBuffer), offset);
          offset += arrayBuffer.byteLength;
        }

        return new NextResponse(combinedArray, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(
              (playlistData?.name || 'playlist').replace(/[^a-z0-9]/gi, '_')
            )}_${voiceId}.mp3"`,
          },
        });
      }
    }

    // Combine all audio blobs into one by concatenating them
    // Note: This is a simple concatenation - for perfect MP3 merging, you'd need ffmpeg
    const totalSize = audioBlobs.reduce((sum, blob) => sum + blob.size, 0);
    const combinedArray = new Uint8Array(totalSize);
    let offset = 0;

    for (const blob of audioBlobs) {
      const arrayBuffer = await blob.arrayBuffer();
      combinedArray.set(new Uint8Array(arrayBuffer), offset);
      offset += arrayBuffer.byteLength;
    }

    // Return the combined audio file
    return new NextResponse(combinedArray, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          (playlistData?.name || 'playlist').replace(/[^a-z0-9]/gi, '_')
        )}_${voiceId}.mp3"`,
      },
    });
  } catch (error) {
    console.error('[playlist-download] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
