import * as FileSystem from 'expo-file-system/legacy';
import {
  execute,
  pickEncoder,
  normalizePath,
  getMediaInformation,
} from 'munim-ffmpeg';

const clamp = (value, min, max) =>
  Math.max(min, Math.min(Number(value) || min, max));

export async function applyZoomEffect(inputUri, options = {}) {
  if (!inputUri) {
    throw new Error('Please select a video first.');
  }

  const zoom = clamp(options.zoom, 1.2, 2.5);
  const duration = clamp(options.duration, 1, 15);
  const inputPath = normalizePath(inputUri);
  const outputPath =
    `${FileSystem.cacheDirectory}zoom_effect_${Date.now()}.mp4`;

  const media = await getMediaInformation(inputPath);
  const streams = media?.streams || [];
  const video = streams.find(stream => stream.codec_type === 'video');

  const width = Number(video?.width);
  const height = Number(video?.height);

  if (!width || !height) {
    throw new Error('Could not read the video dimensions.');
  }

  const rate = String(video.avg_frame_rate || video.r_frame_rate || '30/1');
  const parts = rate.split('/');
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1] || 1);
  const fpsValue = numerator / denominator;
  const fps = Number.isFinite(fpsValue)
    ? Math.max(1, Math.min(60, fpsValue))
    : 30;

  const encoder = await pickEncoder([
    'h264_mediacodec',
    'libopenh264',
    'libx264',
  ]);

  if (!encoder) {
    throw new Error('No supported MP4 video encoder was found.');
  }

  const halfDuration = `(${fps}*${duration}/2)`;
  const filter =
    `zoompan=z='if(lte(on,${halfDuration}),1+(${zoom}-1)*on/${halfDuration},max(1,${zoom}-(${zoom}-1)*(on-${halfDuration})/${halfDuration}))':` +
    `x='iw/2-iw/zoom/2':` +
    `y='ih/2-ih/zoom/2':` +
    `d=1:s=${width}x${height}:fps=${fps},` +
    `setsar=1`;

  const result = await execute([
    '-y',
    '-i', inputPath,
    '-vf', filter,
    '-c:v', encoder,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);

  if (!result.success || result.returnCode !== 0) {
    throw new Error(
      `Video zoom processing failed: ${result.output || 'FFmpeg error'}`
    );
  }

  const info = await FileSystem.getInfoAsync(outputPath);

  if (!info.exists || !info.size) {
    throw new Error('Processed video file was not created.');
  }

  return {
    uri: outputPath,
    fileName: `zoom_effect_${Date.now()}.mp4`,
    type: 'video',
    mimeType: 'video/mp4',
    fileSize: info.size,
    zoom,
    duration,
  };
}

export async function createVideoFromPhotos(photoAssets, options = {}) {
  if (!Array.isArray(photoAssets) || photoAssets.length === 0) {
    throw new Error('Please select at least one photo.');
  }

  const secondsPerPhoto = clamp(options.secondsPerPhoto || 3, 1, 10);
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const outputPath = `${FileSystem.cacheDirectory}photo_video_${Date.now()}.mp4`;
  const encoder = await pickEncoder([
    'h264_mediacodec',
    'libopenh264',
    'libx264',
  ]);

  if (!encoder) {
    throw new Error('No supported MP4 video encoder was found.');
  }

  const args = ['-y'];
  for (const photo of photoAssets) {
    if (!photo?.uri) {
      throw new Error('A selected photo has no file URI.');
    }
    args.push('-loop', '1', '-t', String(secondsPerPhoto), '-i', normalizePath(photo.uri));
  }

  const filters = photoAssets.map((_, index) =>
    `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,` +
    `fps=${fps},format=yuv420p,trim=duration=${secondsPerPhoto},` +
    `setpts=PTS-STARTPTS[v${index}]`
  );

  filters.push(
    `${photoAssets.map((_, index) => `[v${index}]`).join('')}` +
    `concat=n=${photoAssets.length}:v=1:a=0[outv]`
  );

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[outv]',
    '-an',
    '-c:v', encoder,
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-movflags', '+faststart',
    outputPath
  );

  const result = await execute(args);
  if (!result.success || result.returnCode !== 0) {
    throw new Error(`Photo video creation failed: ${result.output || 'FFmpeg error'}`);
  }

  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists || !info.size) {
    throw new Error('The photo video file was not created.');
  }

  return {
    uri: outputPath,
    fileName: `photo_video_${Date.now()}.mp4`,
    type: 'video',
    mimeType: 'video/mp4',
    fileSize: info.size,
    duration: photoAssets.length * secondsPerPhoto,
  };
}

export async function addMusicToVideo(videoUri, audioUri, options = {}) {
  if (!videoUri || !audioUri) {
    throw new Error('Please select both a video and an audio file.');
  }

  const videoPath = normalizePath(videoUri);
  const audioPath = normalizePath(audioUri);
  const outputPath = `${FileSystem.cacheDirectory}music_video_${Date.now()}.mp4`;
  const musicVolume = clamp(options.musicVolume ?? 1, 0, 2);
  const musicStart = clamp(options.musicStart ?? 0, 0, 3600);
  const keepOriginalAudio = options.keepOriginalAudio !== false;
  const media = await getMediaInformation(videoPath);
  const hasOriginalAudio = (media?.streams || []).some(
    stream => stream.codec_type === 'audio'
  );

  const args = [
    '-y',
    '-i', videoPath,
    '-ss', String(musicStart),
    '-i', audioPath,
  ];

  if (keepOriginalAudio && hasOriginalAudio) {
    args.push(
      '-filter_complex',
      `[1:a]volume=${musicVolume}[music];` +
      '[0:a]volume=1[original];' +
      '[original][music]amix=inputs=2:duration=first:dropout_transition=2[aout]',
      '-map', '0:v:0',
      '-map', '[aout]'
    );
  } else {
    args.push(
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-filter:a', `volume=${musicVolume}`
    );
  }

  args.push(
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath
  );

  const result = await execute(args);
  if (!result.success || result.returnCode !== 0) {
    throw new Error(`Adding music failed: ${result.output || 'FFmpeg error'}`);
  }

  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists || !info.size) {
    throw new Error('The music video file was not created.');
  }

  return {
    uri: outputPath,
    fileName: `music_video_${Date.now()}.mp4`,
    type: 'video',
    mimeType: 'video/mp4',
    fileSize: info.size,
  };
}
