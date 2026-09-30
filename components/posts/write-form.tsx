"use client";

import { useActionState, useState } from "react";
import { createPost, type CreatePostState } from "@/actions/post";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/client";
import { Loader2, Upload, X } from "lucide-react";
import Image from "next/image";

type Category = {
  id: string;
  name: string;
};

export function WriteForm({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState<CreatePostState, FormData>(
    createPost,
    {}
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");

  const supabase = createClient();

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `cover-${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from("post-images")
        .upload(filePath, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("post-images").getPublicUrl(filePath);

      setCoverUrl(publicUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to upload cover image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="space-y-8">
      {/* Hidden fields that the server action needs */}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="cover_image_url" value={coverUrl} />
      <input type="hidden" name="category_id" value={categoryId} />

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="An interesting title..."
          className="text-lg h-12"
          required
        />
        {state.errors?.title && (
          <p className="text-sm text-destructive">{state.errors.title[0]}</p>
        )}
      </div>

      {/* Cover Image */}
      <div className="space-y-2">
        <Label>Cover Image (optional)</Label>
        {coverUrl ? (
          <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg border">
            <Image src={coverUrl} alt="Cover" fill className="object-cover" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setCoverUrl("")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="flex aspect-video w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 transition hover:bg-muted/50">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? "Uploading..." : "Click to upload cover image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Category + Tags */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="nextjs, react, tutorial"
          />
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <Label>Content</Label>
        <TiptapEditor content={content} onChange={setContent} />
        {state.errors?.content && (
          <p className="text-sm text-destructive">{state.errors.content[0]}</p>
        )}
      </div>

      {/* Form error */}
      {state.errors?._form && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.errors._form[0]}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title || !content}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish Post
        </Button>
      </div>
    </form>
  );
}