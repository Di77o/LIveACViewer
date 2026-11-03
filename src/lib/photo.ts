export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

export async function preparePhoto(file: File): Promise<{ src: string; width: number; height: number }> {
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose a photo smaller than 30 MB.');
  const blobUrl = URL.createObjectURL(file);
  try {
    let image: HTMLImageElement;
    try { image = await loadImage(blobUrl); }
    catch { throw new Error('This photo could not be opened. Try a JPEG, PNG, or WebP, or take a new photo with your camera.'); }
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the photo. Please try Safari.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return { src: canvas.toDataURL('image/jpeg', 0.88), width, height };
  } finally { URL.revokeObjectURL(blobUrl); }
}
