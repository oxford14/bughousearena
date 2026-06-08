"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarFrameWrapper } from "@/components/arena/avatar-frame";
import { AvatarCropDialog } from "@/components/arena/avatar-crop-dialog";
import { Button } from "@/components/ui/button";
import { removeProfilePhoto, uploadProfilePhoto } from "@/lib/firebase/profile-photo";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";

interface ProfilePhotoUploadProps {
  displayName: string;
  photoURL?: string | null;
  frameId?: string | null;
}

export function ProfilePhotoUpload({
  displayName,
  photoURL,
  frameId,
}: ProfilePhotoUploadProps) {
  const { user, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const previewUrl = photoURL ?? user?.photoURL ?? undefined;
  const busy = removing || cropOpen;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setCropFile(file);
    setCropOpen(true);
  };

  const handleCropConfirm = async (croppedBlob: Blob) => {
    try {
      await uploadProfilePhoto(croppedBlob);
      await refreshProfile();
      toast.success("Profile photo updated.");
      setCropFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload photo.";
      toast.error(message);
      throw err;
    }
  };

  const handleRemove = async () => {
    if (!previewUrl) return;

    setRemoving(true);
    try {
      await removeProfilePhoto();
      await refreshProfile();
      toast.success("Profile photo removed.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not remove photo.";
      toast.error(message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3 sm:items-start">
        <div className="relative group">
          <AvatarFrameWrapper frameId={frameId} className="rounded-full">
            <Avatar className="h-20 w-20 sm:h-16 sm:w-16">
              <AvatarImage src={previewUrl} alt={displayName} />
              <AvatarFallback className="text-lg">
                {displayName[0]?.toUpperCase() ?? "P"}
              </AvatarFallback>
            </Avatar>
          </AvatarFrameWrapper>

          <button
            type="button"
            disabled={removing}
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed"
            aria-label="Change profile photo"
          >
            <Camera className="h-5 w-5 text-white" />
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={removing}
            onChange={handleFileChange}
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={removing}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer"
          >
            <Camera className="h-4 w-4 mr-1.5" />
            Change photo
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removing}
              onClick={() => void handleRemove()}
              className="cursor-pointer text-muted-foreground"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center sm:text-left max-w-xs">
          Choose a photo, crop it to the circle, then we compress and upload it.
        </p>
      </div>

      <AvatarCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropFile(null);
        }}
        onConfirm={handleCropConfirm}
      />
    </>
  );
}
