import * as FileSystem from 'expo-file-system/legacy';
import {
  execute,
  pickEncoder,
  listFilters,
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
  const originalVolume = clamp(options.originalVolume ?? 1, 0, 2);
  const musicStart = clamp(options.musicStart ?? 0, 0, 3600);
  const fadeIn = clamp(options.musicFadeIn ?? 0.6, 0, 5);
  const fadeOut = clamp(options.musicFadeOut ?? 1.2, 0, 5);
  const keepOriginalAudio = options.keepOriginalAudio !== false;
  const media = await getMediaInformation(videoPath);
  const streams = media?.streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const hasOriginalAudio = streams.some((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error('No video track was found in the selected file.');

  const duration = Math.max(0, Number(media?.format?.duration || video.duration || 0));
  const safeFadeOut = duration > 0 ? Math.min(fadeOut, Math.max(0, duration - fadeIn)) : 0;
  const fadeOutStart = duration > 0 ? Math.max(0, duration - safeFadeOut) : 0;
  const musicFilters = [
    `volume=${musicVolume}`,
    ...(fadeIn > 0 ? [`afade=t=in:st=0:d=${fadeIn}`] : []),
    ...(safeFadeOut > 0 ? [`afade=t=out:st=${fadeOutStart}:d=${safeFadeOut}`] : []),
  ];
  const args = [
    '-y',
    '-i', videoPath,
    '-stream_loop', '-1',
    '-ss', String(musicStart),
    '-i', audioPath,
  ];

  if (keepOriginalAudio && hasOriginalAudio) {
    args.push(
      '-filter_complex',
      `[1:a]${musicFilters.join(',')}[music];` +
      `[0:a]volume=${originalVolume}[original];` +
      '[original][music]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[aout]',
      '-map', '0:v:0',
      '-map', '[aout]'
    );
  } else {
    args.push(
      '-filter_complex',
      `[1:a]${musicFilters.join(',')}[aout]`,
      '-map', '0:v:0',
      '-map', '[aout]'
    );
  }

  args.push(
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map_metadata', '0',
    '-shortest',
    '-movflags', '+faststart',
    outputPath
  );

  const result = await execute(args);
  if (!result.success || result.returnCode !== 0) {
    const details = String(result.output || '').trim().slice(-700);
    throw new Error(`Adding music failed: ${details || 'FFmpeg error'}`);
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
    musicVolume,
    originalVolume,
    musicStart,
    keepOriginalAudio,
    musicFadeIn: fadeIn,
    musicFadeOut: safeFadeOut,
  };
}


export const VIDEO_FILTERS = [
  { name: 'Original', value: '' },
  { name: 'Vivid', value: 'eq=contrast=1.18:saturation=1.35:brightness=0.02' },
  { name: 'Cinema', value: 'eq=contrast=1.12:saturation=0.92:brightness=-0.02,colorbalance=rs=0.04:bs=-0.04' },
  { name: 'Warm', value: 'colorbalance=rs=0.10:gs=0.025:bs=-0.08,eq=saturation=1.08' },
  { name: 'Cool', value: 'colorbalance=rs=-0.06:gs=0.015:bs=0.10,eq=saturation=1.04' },
  { name: 'Vintage', value: 'colorbalance=rs=0.06:gs=0.025:bs=-0.035,eq=saturation=0.82:contrast=0.94:brightness=0.015' },
  { name: 'B&W', value: 'hue=s=0,eq=contrast=1.12' },
  { name: 'Dream', value: 'gblur=sigma=0.35,eq=brightness=0.035:saturation=0.9' },
  { name: 'Golden', value: 'colorbalance=rs=0.12:gs=0.04:bs=-0.10,eq=contrast=1.06:saturation=1.16' },
  { name: 'Fade', value: 'eq=contrast=0.82:brightness=0.04:saturation=0.82' },
  { name: 'Teal Noir', value: 'colorbalance=rs=-0.035:gs=0.015:bs=0.095:rm=0.025:bm=-0.035,eq=contrast=1.22:saturation=0.88,vignette=PI/5', premium: true },
  { name: 'Rose Luxe', value: 'colorbalance=rs=0.105:gs=-0.025:bs=0.035,eq=contrast=1.08:saturation=1.12,vignette=PI/6', premium: true },
  { name: 'Emerald', value: 'colorbalance=rs=-0.035:gs=0.09:bs=0.015,eq=contrast=1.13:saturation=1.2', premium: true },
  { name: 'Arctic', value: 'colorbalance=rs=-0.09:gs=0.015:bs=0.12,eq=contrast=1.1:saturation=0.92', premium: true },
  { name: 'Mocha', value: 'colorbalance=rs=0.085:gs=0.025:bs=-0.075,eq=contrast=1.06:saturation=0.88', premium: true },
  { name: 'Neon', value: 'eq=contrast=1.28:saturation=1.62:brightness=0.015,unsharp=5:5:0.55:3:3:0.0', premium: true },
  { name: 'Matte', value: 'eq=contrast=0.88:brightness=0.045:saturation=0.9,colorbalance=rs=0.025:bs=-0.02', premium: true },
  { name: 'Portrait Glow', value: 'gblur=sigma=0.18,eq=brightness=0.025:contrast=1.06:saturation=1.08,unsharp=5:5:0.35:3:3:0.0', premium: true },
  { name: 'Cyber', value: 'colorbalance=rs=0.07:gs=-0.025:bs=0.12,eq=contrast=1.2:saturation=1.38', premium: true },
  { name: 'Film', value: 'noise=alls=5:allf=t+u,eq=contrast=1.06:saturation=0.9,colorbalance=rs=0.035:bs=-0.025', premium: true },
];

export const VOICE_EFFECTS = [
  { name: 'Original', value: '' },
  { name: 'Deep', value: 'asetrate=36162,aresample=44100,atempo=1.2195' },
  { name: 'High', value: 'asetrate=52920,aresample=44100,atempo=0.8333' },
  { name: 'Echo', value: 'aecho=0.8:0.88:650:0.32' },
  { name: 'Robot', value: 'highpass=f=250,lowpass=f=3000,aecho=0.8:0.7:45:0.25' },
  { name: 'Radio', value: 'highpass=f=350,lowpass=f=3000,acompressor=threshold=0.08:ratio=3:attack=10:release=100' },
];

export async function applyVideoEffects(videoUri, options = {}) {
  if (!videoUri) throw new Error('Please select a video first.');
  const filterIndex = Math.round(clamp(options.videoFilterIndex ?? 0, 0, VIDEO_FILTERS.length - 1));
  const filter = VIDEO_FILTERS[filterIndex]?.value || '';
  const voice = VOICE_EFFECTS.find(item => item.name === options.voiceEffect)?.value || '';
  if (!filter && !voice) return { uri: videoUri, type: 'video', mimeType: 'video/mp4' };

  // Check the actual native FFmpeg build before starting an export.
  const requiredFilters = [filter, voice]
    .filter(Boolean)
    .join(',')
    .match(/(?:^|,)([a-zA-Z0-9_]+)=/g) || [];
  const requiredFilterNames = [...new Set(
    requiredFilters.map(item => item.replace(/^,/, '').replace(/=$/, ''))
  )];
  const availableFilters = await listFilters();
  const missingFilters = requiredFilterNames.filter(
    name => !availableFilters.includes(name)
  );
  if (missingFilters.length) {
    throw new Error(
      `These filters are not supported by this device's video engine: ${missingFilters.join(', ')}. Please choose another filter.`
    );
  }

  const inputPath = normalizePath(videoUri);
  const outputPath = `${FileSystem.cacheDirectory}edited_video_${Date.now()}.mp4`;
  const media = await getMediaInformation(inputPath);
  const streams = media?.streams || [];
  const hasAudio = streams.some(stream => stream.codec_type === 'audio');
  const hasVideo = streams.some(stream => stream.codec_type === 'video');
  if (!hasVideo) throw new Error('No video track was found in the selected file.');
  if (voice && !hasAudio) throw new Error('This video has no original audio. Choose a video with audio to apply a Voice Effect.');
  const videoEncoder = await pickEncoder([
    'h264_videotoolbox',
    'h264_mediacodec',
    'libopenh264',
  ]);
  if (!videoEncoder) throw new Error('No supported MP4 video encoder was found.');
  const outputPixelFormat =
    videoEncoder === 'h264_mediacodec' ? 'nv12' : 'yuv420p';
  const args = ['-y', '-i', inputPath, '-map', '0:v:0'];
  if (hasAudio) args.push('-map', '0:a:0'); else args.push('-an');
  if (filter) args.push('-vf', filter);
  if (hasAudio && voice) args.push('-af', voice);
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', videoEncoder, '-pix_fmt', outputPixelFormat, '-map_metadata', '0', '-map_chapters', '0', '-movflags', '+faststart', outputPath);
  const result = await execute(args);
  if (!result.success || result.returnCode !== 0) {
    const details = String(result.output || '').trim().slice(-900);
    throw new Error(`The video filter could not be applied. Please choose another filter or select the video again.${details ? `\n\nTechnical details: ${details}` : ''}`);
  }
  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists || !info.size) throw new Error('Edited video file was not created.');
  return { uri: outputPath, fileName: `edited_video_${Date.now()}.mp4`, type: 'video', mimeType: 'video/mp4', fileSize: info.size, appliedFilter: VIDEO_FILTERS[filterIndex].name, appliedVoiceEffect: options.voiceEffect || 'Original' };
}
