"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateProfile, type UpdateProfileState } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/client";
import { Crop, Loader2, Upload, X } from "lucide-react";

const cropSize = 512;

type SelectedImage = {
  file: File;
  url: string;
};

function clampPosition(value: number): number {
  return Math.max(0, Math.min(100, value));
}

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function ProfileEditor({
  userId,
  username,
  fullName,
  bio,
  avatarUrl,
}: {
  userId: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    UpdateProfileState,
    FormData
  >(updateProfile, {});
  const [avatarPath, setAvatarPath] = useState("");
  const [previewUrl, setPreviewUrl] = useState(avatarUrl || "");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 50, y: 50 });
  const [cropZoom, setCropZoom] = useState(1);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const cropFrameRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (selectedImage) URL.revokeObjectURL(selectedImage.url);
    },
    [selectedImage],
  );

  const updateCropPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingCrop || !cropFrameRef.current) return;
    const rect = cropFrameRef.current.getBoundingClientRect();
    setCropPosition({
      x: clampPosition(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPosition(((event.clientY - rect.top) / rect.height) * 100),
    });
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      setUploadError("Choose a JPEG, PNG, WebP, or GIF image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Profile images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadError(null);
    setCropPosition({ x: 50, y: 50 });
    setCropZoom(1);
    setSelectedImage({ file, url: URL.createObjectURL(file) });
    event.target.value = "";
  };

  const applyCrop = async () => {
    if (!selectedImage) return;

    setUploadError(null);
    setUploading(true);
    try {
      const sourceImage = new window.Image();
      sourceImage.src = selectedImage.url;
      await sourceImage.decode();

      const baseScale = Math.max(
        cropSize / sourceImage.naturalWidth,
        cropSize / sourceImage.naturalHeight,
      );
      const sourceCropSize = cropSize / (baseScale * cropZoom);
      const sourceX =
        ((sourceImage.naturalWidth - sourceCropSize) * cropPosition.x) / 100;
      const sourceY =
        ((sourceImage.naturalHeight - sourceCropSize) * cropPosition.y) / 100;
      const canvas = document.createElement("canvas");
      canvas.width = cropSize;
      canvas.height = cropSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create image crop.");
      context.drawImage(
        sourceImage,
        sourceX,
        sourceY,
        sourceCropSize,
        sourceCropSize,
        0,
        0,
        cropSize,
        cropSize,
      );
      const croppedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not encode cropped image."));
          },
          "image/jpeg",
          0.9,
        );
      });

      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user || user.id !== userId) {
        setUploadError("Sign in again before uploading a profile image.");
        return;
      }

      const extension = "jpg";
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("post-images")
        .upload(path, croppedBlob, { contentType: "image/jpeg" });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-images").getPublicUrl(path);
      setAvatarPath(path);
      setPreviewUrl(publicUrl);
      setRemoveAvatar(false);
      setSelectedImage(null);
    } catch (error) {
      console.error("Error uploading profile image:", error);
      setUploadError("Could not crop or upload the image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const initials = (fullName || username)[0]?.toUpperCase() || "U";

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="avatarPath" value={avatarPath} />
      <input
        type="hidden"
        name="removeAvatar"
        value={removeAvatar ? "true" : "false"}
      />

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-24 w-24 border">
            <AvatarImage src={previewUrl} alt="Profile image preview" />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <div>
              <h2 className="font-semibold">Profile photo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                JPEG, PNG, WebP, or GIF. Maximum size 5 MB.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Label
                htmlFor="avatar-upload"
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Upload photo"}
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleAvatarUpload}
                disabled={uploading || isPending}
              />
              {(previewUrl || avatarPath) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviewUrl("");
                    setAvatarPath("");
                    setRemoveAvatar(true);
                    setUploadError(null);
                  }}
                  disabled={uploading || isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove photo
                </Button>
              )}
            </div>
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </section>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onPointerUp={() => setDraggingCrop(false)}
          onPointerCancel={() => setDraggingCrop(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-crop-title"
            className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="avatar-crop-title" className="text-lg font-semibold">
                  Adjust your profile photo
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag the image to position it, then adjust the zoom.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancel image crop"
                disabled={uploading}
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex justify-center">
              <div
                ref={cropFrameRef}
                className="relative aspect-square w-full max-w-[280px] touch-none cursor-move overflow-hidden rounded-full border-2 border-primary bg-muted"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingCrop(true);
                  updateCropPosition(event);
                }}
                onPointerMove={updateCropPosition}
                onPointerUp={() => setDraggingCrop(false)}
                onPointerCancel={() => setDraggingCrop(false)}
                aria-label="Drag image to adjust crop"
              >
                <Image
                  src={selectedImage.url}
                  alt="Image crop preview"
                  fill
                  unoptimized
                  draggable={false}
                  className="pointer-events-none select-none object-cover"
                  style={{
                    objectPosition: `${cropPosition.x}% ${cropPosition.y}%`,
                    transform: `scale(${cropZoom})`,
                  }}
                />
                <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/30" />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="avatar-zoom">Zoom</Label>
                <span className="text-xs text-muted-foreground">
                  {cropZoom.toFixed(1)}×
                </span>
              </div>
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="w-full accent-primary"
                disabled={uploading}
              />
            </div>

            {uploadError && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {uploadError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedImage(null)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={applyCrop}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crop className="mr-2 h-4 w-4" />
                )}
                {uploading ? "Saving photo..." : "Use this photo"}
              </Button>
            </div>
          </section>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Display name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName || ""}
          autoComplete="name"
          maxLength={80}
          required
        />
        <p className="text-xs text-muted-foreground">
          This is the name shown on your profile and stories.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring">
          <span className="pl-3 text-sm text-muted-foreground">@</span>
          <Input
            id="username"
            name="username"
            defaultValue={username}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            className="border-0 focus-visible:ring-0"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Use 3–30 letters, numbers, or underscores. Your profile URL will
          change when you update this.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">About you</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={bio || ""}
          placeholder="Share a little about yourself..."
          maxLength={500}
          rows={5}
        />
        <p className="text-xs text-muted-foreground">Up to 500 characters.</p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
        <Button type="button" variant="outline" asChild>
          <Link href={`/profile/${encodeURIComponent(username)}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending || uploading}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
