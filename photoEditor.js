import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { execute, normalizePath } from 'munim-ffmpeg';

export const POST_PHOTO_FILTERS = [
  { name: 'Original', value: null, overlay: 'transparent', opacity: 0 },
  { name: 'Clarendon', value: 'eq=contrast=1.18:saturation=1.28:brightness=0.02', overlay: '#3979B8', opacity: 0.10 },
  { name: 'Gingham', value: 'colorbalance=rs=0.04:gs=0.02:bs=0.06,eq=contrast=0.92:saturation=0.82', overlay: '#D8C5A2', opacity: 0.12 },
  { name: 'Moon', value: 'hue=s=0,eq=contrast=1.12:brightness=0.03', overlay: '#667080', opacity: 0.12 },
  { name: 'Lark', value: 'eq=brightness=0.06:contrast=0.94:saturation=0.88', overlay: '#D8C99A', opacity: 0.08 },
  { name: 'Reyes', value: 'colorbalance=rs=0.06:gs=0.025:bs=-0.035,eq=contrast=0.88:saturation=0.78:brightness=0.035', overlay: '#C9A77B', opacity: 0.14 },
  { name: 'Juno', value: 'colorbalance=rs=0.08:gs=0.015:bs=-0.04,eq=contrast=1.08:saturation=1.22', overlay: '#D78A48', opacity: 0.08 },
  { name: 'Slumber', value: 'colorbalance=rs=0.025:gs=0.015:bs=0.055,eq=contrast=0.90:saturation=0.72:brightness=0.025', overlay: '#7086A5', opacity: 0.12 },
  { name: 'Crema', value: 'colorbalance=rs=0.06:gs=0.025:bs=-0.025,eq=contrast=0.94:saturation=0.88:brightness=0.025', overlay: '#D9B58B', opacity: 0.10 },
  { name: 'Ludwig', value: 'colorbalance=rs=0.035:gs=0.015:bs=-0.025,eq=contrast=1.10:saturation=0.92', overlay: '#C69B76', opacity: 0.07 },
  { name: 'Aden', value: 'colorbalance=rs=0.025:gs=0.025:bs=0.06,eq=contrast=0.90:saturation=0.78:brightness=0.035', overlay: '#A9B9C9', opacity: 0.12 },
  { name: 'Perpetua', value: 'colorbalance=rs=-0.025:gs=0.025:bs=0.06,eq=contrast=1.02:saturation=0.92', overlay: '#4B9A9A', opacity: 0.09 },
  { name: 'Amaro', value: 'colorbalance=rs=0.07:gs=0.02:bs=-0.035,eq=brightness=0.045:contrast=0.96:saturation=1.08', overlay: '#D9A66D', opacity: 0.10 },
  { name: 'Valencia', value: 'colorbalance=rs=0.09:gs=0.025:bs=-0.055,eq=brightness=0.025:contrast=0.96:saturation=0.92', overlay: '#D98D55', opacity: 0.11 },
  { name: 'Inkwell', value: 'hue=s=0,eq=contrast=1.18:brightness=0.015', overlay: '#30343B', opacity: 0.08 },
  { name: 'Sierra', value: 'colorbalance=rs=0.045:gs=0.02:bs=-0.02,eq=contrast=0.94:saturation=0.9', overlay: '#D4B58B', opacity: 0.09 },
  { name: 'Hefe', value: 'eq=contrast=1.22:saturation=1.2:brightness=-0.015', overlay: '#B98A58', opacity: 0.10 },
  { name: 'Nashville', value: 'colorbalance=rs=0.09:gs=0.025:bs=-0.07,eq=contrast=0.92:saturation=0.88', overlay: '#D9B28C', opacity: 0.12 },
  { name: 'Brooklyn', value: 'colorbalance=rs=-0.025:gs=0.025:bs=0.07,eq=contrast=0.9:saturation=0.86', overlay: '#9BB6C8', opacity: 0.10 },
  { name: 'Maven', value: 'eq=brightness=0.025:contrast=0.92:saturation=0.82', overlay: '#B9A1A0', opacity: 0.08 },
  { name: 'Rise', value: 'colorbalance=rs=0.07:gs=0.02:bs=-0.035,eq=brightness=0.045:contrast=0.9:saturation=0.9', overlay: '#E1B28B', opacity: 0.10 },
  { name: 'X-Pro', value: 'eq=contrast=1.3:saturation=1.18:brightness=-0.02', overlay: '#405B72', opacity: 0.08 },
  { name: 'Lo-Fi', value: 'eq=contrast=1.35:saturation=1.3', overlay: '#A66B48', opacity: 0.07 },
  { name: 'Soft Glow', value: 'gblur=sigma=0.25,eq=brightness=0.035:contrast=0.92:saturation=0.96', overlay: '#E4C9B8', opacity: 0.08 },
  { name: 'Arctic', value: 'colorbalance=rs=-0.08:gs=0.015:bs=0.12,eq=contrast=1.06:saturation=0.94', overlay: '#8DB5D4', opacity: 0.08 },
  { name: 'Sunset', value: 'colorbalance=rs=0.13:gs=0.035:bs=-0.12,eq=brightness=0.025:saturation=1.18', overlay: '#F09A67', opacity: 0.10 },
];

export function getPostPhotoFilter(index) {
  return POST_PHOTO_FILTERS[index] || POST_PHOTO_FILTERS[0];
}

async function renderPostPhotoFilter(asset, filterIndex, brightness = 0) {
  if (!asset?.uri) throw new Error('Please select a photo first.');

  const baseUri = asset.photoBaseUri || asset.uri;
  const preset = getPostPhotoFilter(filterIndex);
  const filters = [];

  if (preset.value) filters.push(preset.value);
  if (brightness > 0) filters.push(`eq=brightness=${brightness}`);

  if (!filters.length) {
    return {
      ...asset,
      uri: baseUri,
      photoFilterIndex: 0,
      photoBrightness: brightness,
      photoBaseUri: baseUri,
      type: 'image',
      mimeType: 'image/jpeg',
    };
  }

  const outputPath = `${FileSystem.cacheDirectory}post_filter_${Date.now()}.jpg`;
  const result = await execute([
    '-y', '-i', normalizePath(baseUri),
    '-vf', filters.join(','),
    '-frames:v', '1', '-q:v', '2',
    outputPath,
  ]);

  if (!result.success || result.returnCode !== 0) {
    const details = String(result.output || '').trim().slice(-700);
    throw new Error(
      `फोटो फ़िल्टर लागू नहीं हो पाया। Original चुनकर दोबारा कोशिश करें।${details ? `\\n\\nतकनीकी विवरण: ${details}` : ''}`
    );
  }

  const info = await FileSystem.getInfoAsync(outputPath);
  if (!info.exists || !info.size) {
    throw new Error('फ़िल्टर की गई फोटो फ़ाइल नहीं बनी। Original फ़िल्टर चुनकर दोबारा कोशिश करें।');
  }

  return {
    ...asset,
    uri: outputPath,
    type: 'image',
    mimeType: 'image/jpeg',
    fileName: `post_filtered_${Date.now()}.jpg`,
    fileSize: info.size,
    photoFilterIndex: filterIndex,
    photoBrightness: brightness,
    photoBaseUri: baseUri,
  };
}

export async function applyPostPhotoFilter(asset, filterIndex) {
  return renderPostPhotoFilter(asset, filterIndex, Number(asset?.photoBrightness || 0));
}

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
      if (!width || !height) throw new Error('Could not read photo dimensions.');

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
      asset.photoBaseUri || asset.uri,
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
      photoFilterIndex: 0,
      photoBrightness: 0,
      photoBaseUri: result.uri,
    };
  }

  let filterIndex = Number(asset.photoFilterIndex ?? 0);
  let brightness = Number(asset.photoBrightness || 0);

  if (action === 'filter') {
    filterIndex = (filterIndex + 1) % POST_PHOTO_FILTERS.length;
  } else if (action.startsWith('filter:')) {
    filterIndex = Math.max(0, Math.min(
      POST_PHOTO_FILTERS.length - 1,
      Number(action.slice(7)) || 0
    ));
  } else if (action === 'brightness') {
    brightness = Math.min(0.5, Number((brightness + 0.1).toFixed(1)));
  } else {
    throw new Error('Unsupported photo editing action.');
  }

  return renderPostPhotoFilter(asset, filterIndex, brightness);
}
