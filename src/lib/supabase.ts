import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client (limited permissions)
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server-side Supabase client (full permissions for storage operations)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  DL_IMAGES: "dl-images",
  SIGNATURES: "signatures",
  WORK_PHOTOS: "work-photos",
} as const;

/**
 * Upload a file to a Supabase Storage bucket
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob,
  contentType: string
) {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) throw error;
  return data.path;
}

/**
 * Get a signed URL for private file access (expires in 1 hour)
 */
export async function getSignedUrl(bucket: string, path: string) {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}
