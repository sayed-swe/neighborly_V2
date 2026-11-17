/**
 * Prepares a photo for upload: downsizes to 1600 px and re-encodes as JPEG in the browser.
 * Re-encoding drops EXIF data (including GPS), so a photo can't reveal where someone lives.
 * The server strips metadata again regardless; this also keeps uploads small on mobile data.
 */
export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch { /* fall through to the original file */ }
  if (['image/jpeg', 'image/png'].includes(file.type) && file.size <= 5 * 1024 * 1024) return file;
  throw new Error('That image couldn’t be read. Try a JPEG or PNG under 5 MB.');
}
