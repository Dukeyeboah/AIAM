# Music Upload Guide for AiAm

## How to Upload Songs to Firebase Storage

### Step 1: Access Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **aiam-95e87**
3. Navigate to **Storage** in the left sidebar

### Step 2: Create Music Folder

1. In Firebase Storage, click **"Get Started"** or open your existing bucket
2. Click **"Upload file"** or create a folder first
3. Create a folder named: `music` (all lowercase)

### Step 3: Upload Your Songs

1. Click into the `music` folder
2. Click **"Upload file"**
3. Upload your music files (MP3, M4A, or other audio formats)
4. **Important**: Upload files in the order you want them to appear. The app will assign names based on upload order:
   - 1st file → "Cosmic Flow"
   - 2nd file → "Serene Mind"
   - 3rd file → "Inner Peace"
   - 4th file → "Ethereal Dreams"
   - 5th file → "Zen Garden"
   - 6th file → "Meditation Waves"
   - 7th file → "Tranquil Space"
   - 8th file → "Sacred Silence"
   - 9th file → "Mindful Journey"
   - 10th file → "Harmony Within"

### Step 4: Set Storage Rules (REQUIRED - FIXES PERMISSION ERROR)

**You MUST update your Firebase Storage rules** to allow public read access for the music folder. This fixes the "User does not have permission" error!

1. Go to Firebase Console → **Storage** → **Rules** tab
2. Replace your current rules with (keep your existing user rules):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Public music folder - allows anyone to read music files
    match /music/{allPaths=**} {
      allow read: if true;
      allow write: if false; // Only upload via console
    }

    // Your existing user rules (keep these!)
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Optional: Deny everything else by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **"Publish"** to save the rules
4. Wait a few seconds for the rules to propagate
5. Refresh your app - the music player should now work!

### Recommended Music Types

For the best experience with AiAm's meditation/affirmation vibe, consider:

- **Ambient music** (calm, atmospheric)
- **Meditation tracks** (peaceful, minimal)
- **Nature sounds** (ocean, rain, forest)
- **Binaural beats** (for deep focus)
- **Instrumental** (piano, strings, soft synths)

### File Format Recommendations

- **Format**: MP3 or M4A
- **Bitrate**: 128-192 kbps (good quality, reasonable file size)
- **Duration**: 3-10 minutes per track (or longer for ambient tracks)
- **File size**: Keep under 10MB per file for faster loading

### Testing

After uploading:

1. Refresh your app
2. Click the music icon in the header
3. The player should appear with your uploaded songs
4. Click the hamburger menu (☰) to see the full song list

## Troubleshooting

**Songs not appearing?**

- Make sure files are in the `music` folder (not root)
- Check that Storage rules allow public read access
- Refresh the page after uploading

**Player not showing?**

- The player only appears when songs are detected
- Check browser console for any errors
- Verify Firebase Storage is properly configured

**Songs not playing?**

- Check browser console for CORS or loading errors
- Ensure audio files are in a supported format (MP3, M4A, OGG)
- Try a different browser to rule out browser-specific issues
