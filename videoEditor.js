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
