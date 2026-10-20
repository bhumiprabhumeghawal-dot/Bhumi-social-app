import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, normalizePath } from 'munim-ffmpeg';

const FILTERS = [
  { name: 'Warm', value: 'colorbalance=rs=0.08:gs=0.02:bs=-0.05' },
  { name: 'B&W', value: 'hue=s=0' },
  { name: 'Vivid', value: 'eq=saturation=1.45:contrast=1.08' },
];

export async function editPhotoAsset(asset, action) {
  if (!asset?.uri) throw new Error('Please select a photo first.');

  if (['crop', 'rotate', 'flip'].includes(action)) {
    let actions = [];

    if (action === 'rotate') {
      actions = [{ rotate: 90 }];
    } else if (action === 'flip') {
      actions = [{ flip: ImageManipulator.FlipType.Horizontal }];
    } else {
      const width = Number(asset.width);
      const height = Number(asset.height);

      if (!width || !height) {
        throw new Error('Could not read photo dimensions.');
      }

      const side = Math.min(width, height);
      actions = [{
        crop: {
          originX: Math.floor((width - side) / 2),
          originY: Math.floor((height - side) / 2),
          width: side,
          height: side,
        },
      }];
    }

    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      actions,
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      ...asset,
      uri: result.uri,
      width: result.width,
      height: result.height,
      type: 'image',
      mimeType: 'image/jpeg',
      fileName: `edited_${Date.now()}.jpg`,
      photoFilterIndex: -1,
      photoBrightness: 0,
      photoBaseUri: result.uri,
    };
  }

  let filterIndex = Number(asset.photoFilterIndex ?? -1);
  let brightness = Number(asset.photoBrightness || 0);

  if (action === 'filter') {
    filterIndex = (filterIndex + 1) % FILTERS.length;
  } else if (action === 'brightness') {
    brightness = Math.min(0.5, Number((brightness + 0.1).toFixed(1)));
  } else {
    throw new Error('Unsupported photo editing action.');
  }

  const baseUri = asset.photoBaseUri || asset.uri;
  const filters = [];

  if (filterIndex >= 0 && FILTERS[filterIndex]) {
    filters.push(FILTERS[filterIndex].value);
  }
  if (brightness > 0) {
    filters.push(`eq=brightness=${brightness}`);
  }

  if (filters.length === 0) {
    return {
      ...asset,
      photoFilterIndex: filterIndex,
      photoBrightness: brightness,
      photoBaseUri: baseUri,
    };
  }

  const filter = filters.join(',');

  const outputPath = `${FileSystem.cacheDirectory}photo_edit_${Date.now()}.jpg`;
  const result = await execute([
    '-y',
    '-i', normalizePath(baseUri),
    '-vf', filter,
    '-frames:v', '1',
    '-q:v', '2',
    outputPath,
  ]);

  if (!result.success || result.returnCode !== 0) {
    throw new Error(`Photo processing failed: ${result.output || 'FFmpeg error'}`);
  }

  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists || !info.size) {
    throw new Error('Edited photo file was not created.');
  }

  return {
    ...asset,
    uri: outputPath,
    type: 'image',
    mimeType: 'image/jpeg',
    fileName: `edited_${Date.now()}.jpg`,
    fileSize: info.size,
    photoFilterIndex: filterIndex,
    photoBrightness: brightness,
    photoBaseUri: baseUri,
  };
}
