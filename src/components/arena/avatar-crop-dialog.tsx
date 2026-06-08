"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clampAvatarCrop,
  DEFAULT_AVATAR_CROP,
  renderAvatarCrop,
  type AvatarCropTransform,
} from "@/lib/media/crop-avatar-image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const VIEWPORT_SIZE = 280;

interface AvatarCropDialogProps {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (croppedBlob: Blob) => Promise<void>;
}

export function AvatarCropDialog({
  file,
  open,
  onOpenChange,
  onConfirm,
}: AvatarCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<AvatarCropTransform>(DEFAULT_AVATAR_CROP);
  const [loadingImage, setLoadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null
  );

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      setTransform(DEFAULT_AVATAR_CROP);
      return;
    }

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);
    setLoadingImage(true);

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!cancelled) {
        setImage(img);
        setTransform(DEFAULT_AVATAR_CROP);
        setLoadingImage(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setLoadingImage(false);
        onOpenChange(false);
        toast.error("Could not load image.");
      }
    };
    img.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, open, onOpenChange]);

  const clamped = image
    ? clampAvatarCrop(transform, image.naturalWidth, image.naturalHeight, VIEWPORT_SIZE)
    : transform;

  const drawMetrics = image
    ? (() => {
        const baseScale =
          VIEWPORT_SIZE / Math.min(image.naturalWidth, image.naturalHeight);
        const scale = baseScale * clamped.zoom;
        const drawW = image.naturalWidth * scale;
        const drawH = image.naturalHeight * scale;
        const left = (VIEWPORT_SIZE - drawW) / 2 + clamped.offsetX;
        const top = (VIEWPORT_SIZE - drawH) / 2 + clamped.offsetY;
        return { drawW, drawH, left, top };
      })()
    : null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: clamped.offsetX,
      offsetY: clamped.offsetY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !image) return;
    const next = clampAvatarCrop(
      {
        ...clamped,
        offsetX: drag.offsetX + (event.clientX - drag.x),
        offsetY: drag.offsetY + (event.clientY - drag.y),
      },
      image.naturalWidth,
      image.naturalHeight,
      VIEWPORT_SIZE
    );
    setTransform(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleConfirm = async () => {
    if (!image || saving) return;
    setSaving(true);
    try {
      const canvas = renderAvatarCrop(image, VIEWPORT_SIZE, clamped, 512);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Could not export crop.")),
          "image/jpeg",
          0.92
        );
      });
      await onConfirm(blob);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const setZoom = useCallback(
    (zoom: number) => {
      if (!image) return;
      setTransform((prev) =>
        clampAvatarCrop(
          { ...prev, zoom },
          image.naturalWidth,
          image.naturalHeight,
          VIEWPORT_SIZE
        )
      );
    },
    [image]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Crop profile photo</DialogTitle>
          <DialogDescription>
            Drag to reposition and zoom so your face fits the circle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "relative touch-none select-none overflow-hidden rounded-full",
              "border-2 border-primary/40 bg-black/40 shadow-inner",
              saving && "pointer-events-none opacity-70"
            )}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {loadingImage ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : image && drawMetrics ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt="Crop preview"
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{
                  width: drawMetrics.drawW,
                  height: drawMetrics.drawH,
                  left: drawMetrics.left,
                  top: drawMetrics.top,
                }}
              />
            ) : null}

            <div
              className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/25 ring-inset"
              aria-hidden
            />
          </div>

          <label className="flex w-full max-w-xs items-center gap-3 text-sm">
            <span className="shrink-0 text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={clamped.zoom}
              disabled={!image || saving}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!image || loadingImage || saving}
            onClick={() => void handleConfirm()}
            className="cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Uploading…
              </>
            ) : (
              "Save photo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
