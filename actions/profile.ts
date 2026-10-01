"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(80, "Name must be 80 characters or fewer."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be 30 characters or fewer.")
    .regex(/^[a-z0-9_]+$/, "Use only lowercase letters, numbers, and underscores."),
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer."),
  avatarPath: z.string().trim().max(512).optional().default(""),
  removeAvatar: z.enum(["true", "false"]).default("false"),
});

export type UpdateProfileState = {
  error?: string;
};

export async function updateProfile(
  _previousState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    bio: formData.get("bio"),
    avatarPath: formData.get("avatarPath") || "",
    removeAvatar: formData.get("removeAvatar") || "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Check your profile details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying profile editor:", authError);
    return { error: "Could not verify your account. Please try again." };
  }
  if (!user) return { error: "Sign in to edit your profile." };

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("username, is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error loading profile for edit:", profileError);
    return { error: "Could not load your profile. Please try again." };
  }
  if (!currentProfile || currentProfile.is_banned || currentProfile.deleted_at) {
    return { error: "Your account cannot edit its profile." };
  }

  const { avatarPath, removeAvatar, ...profileFields } = parsed.data;
  if (
    avatarPath &&
    (!avatarPath.startsWith(`${user.id}/`) ||
      !/^avatar-[a-zA-Z0-9-]+\.(jpg|png|webp|gif)$/.test(
        avatarPath.slice(`${user.id}/`.length),
      ))
  ) {
    return { error: "Choose a profile image uploaded to your own account." };
  }

  const profileUpdate: {
    full_name: string;
    username: string;
    bio: string | null;
    avatar_url?: string | null;
  } = {
    full_name: profileFields.fullName,
    username: profileFields.username,
    bio: profileFields.bio || null,
  };

  if (removeAvatar === "true") {
    profileUpdate.avatar_url = null;
  } else if (avatarPath) {
    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(avatarPath);
    profileUpdate.avatar_url = publicUrl;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { error: "That username is already taken." };
    }
    console.error("Error updating profile:", updateError);
    return { error: "Could not save your profile. Please try again." };
  }

  revalidatePath(`/profile/${currentProfile.username}`);
  revalidatePath(`/profile/${profileFields.username}`);
  revalidatePath("/", "layout");
  redirect(`/profile/${encodeURIComponent(profileFields.username)}`);
}
