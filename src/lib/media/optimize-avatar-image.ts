export interface OptimizedAvatarImage {
  blob: Blob;
  contentType: string;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  bytes: number;
}

const MAX_OUTPUT_PX = 256;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const TARGET_MAX_BYTES = 120 * 1024;
const MIN_QUALITY = 0.52;
const LOAD_BITMAP_TIMEOUT_MS = 20_000;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image."))),
      type,
      quality
    );
  });
}

function supportsWebpExport(canvas: HTMLCanvasElement): boolean {
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function loadBitmap(source: Blob): Promise<ImageBitmap> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Image processing timed out. Try a smaller photo.")), LOAD_BITMAP_TIMEOUT_MS);
  });
  return Promise.race([
    createImageBitmap(source, { imageOrientation: "from-image" }),
    timeout,
  ]);
}

/**
 * Resize and compress an avatar blob for Firebase Storage.
 * Expects a square crop from the crop dialog.
 */
export async function optimizeAvatarImage(source: Blob | File): Promise<OptimizedAvatarImage> {
  if (!source.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (source.size > MAX_INPUT_BYTES) {
    throw new Error("Image is too large. Choose one under 12 MB.");
  }

  const bitmap = await loadBitmap(source);

  const canvas = document.createElement("canvas");
  canvas.width = MAX_OUTPUT_PX;
  canvas.height = MAX_OUTPUT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image.");
  }

  ctx.drawImage(bitmap, 0, 0, MAX_OUTPUT_PX, MAX_OUTPUT_PX);
  bitmap.close();

  const useWebp = supportsWebpExport(canvas);
  const contentType = useWebp ? "image/webp" : "image/jpeg";
  const ext = useWebp ? "webp" : "jpg";
  let quality = useWebp ? 0.82 : 0.85;

  let blob = await canvasToBlob(canvas, contentType, quality);
  while (blob.size > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.07;
    blob = await canvasToBlob(canvas, contentType, quality);
  }

  return {
    blob,
    contentType,
    ext,
    width: MAX_OUTPUT_PX,
    height: MAX_OUTPUT_PX,
    bytes: blob.size,
  };
}
