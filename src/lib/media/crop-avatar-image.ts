export interface AvatarCropTransform {
  /** 1 = fit min edge to viewport; >1 zooms in. */
  zoom: number;
  /** Pan offset in viewport pixels from centered image. */
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_AVATAR_CROP: AvatarCropTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export function clampAvatarCrop(
  transform: AvatarCropTransform,
  imageWidth: number,
  imageHeight: number,
  viewportSize: number
): AvatarCropTransform {
  const baseScale = viewportSize / Math.min(imageWidth, imageHeight);
  const scale = baseScale * transform.zoom;
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;

  const maxOffsetX = Math.max(0, (drawW - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (drawH - viewportSize) / 2);

  return {
    zoom: Math.max(1, Math.min(3, transform.zoom)),
    offsetX: Math.max(-maxOffsetX, Math.min(maxOffsetX, transform.offsetX)),
    offsetY: Math.max(-maxOffsetY, Math.min(maxOffsetY, transform.offsetY)),
  };
}

/** Render the visible circle region to a square canvas (for avatar upload). */
export function renderAvatarCrop(
  image: HTMLImageElement,
  viewportSize: number,
  transform: AvatarCropTransform,
  outputSize: number
): HTMLCanvasElement {
  const crop = clampAvatarCrop(
    transform,
    image.naturalWidth,
    image.naturalHeight,
    viewportSize
  );

  const baseScale = viewportSize / Math.min(image.naturalWidth, image.naturalHeight);
  const scale = baseScale * crop.zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const vx = (viewportSize - drawW) / 2 + crop.offsetX;
  const vy = (viewportSize - drawH) / 2 + crop.offsetY;

  const sx = -vx / scale;
  const sy = -vy / scale;
  const sSize = viewportSize / scale;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare crop canvas.");

  ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);
  return canvas;
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load image."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function cropFileToBlob(
  file: File,
  transform: AvatarCropTransform,
  viewportSize = 280,
  outputSize = 512
): Promise<Blob> {
  const image = await loadImageFromFile(file);
  const canvas = renderAvatarCrop(image, viewportSize, transform, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export crop."))),
      "image/jpeg",
      0.92
    );
  });
}
