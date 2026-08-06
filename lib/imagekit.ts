export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  name: string;
  filePath: string;
}

function getPrivateKey(): string {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || process.env.Image_kit_private_key;
  if (!privateKey) {
    throw new Error("IMAGEKIT_PRIVATE_KEY is not configured in environment variables.");
  }
  return privateKey;
}

/**
 * Uploads a PDF file buffer to ImageKit.
 */
export async function uploadResumeToImageKit(
  pdfBuffer: Buffer,
  fileName: string,
  folder: string = "/resumes"
): Promise<ImageKitUploadResult> {
  const privateKey = getPrivateKey();
  const base64File = pdfBuffer.toString("base64");

  const formData = new FormData();
  formData.append("file", base64File);
  formData.append("fileName", fileName);
  formData.append("folder", folder);
  formData.append("useUniqueFileName", "true");

  const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`ImageKit upload failed (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const json = await response.json();
  return {
    fileId: json.fileId,
    url: json.url,
    name: json.name,
    filePath: json.filePath,
  };
}

/**
 * Deletes a file from ImageKit by file ID.
 */
export async function deleteResumeFromImageKit(fileId: string): Promise<void> {
  if (!fileId || typeof fileId !== "string" || !fileId.trim()) return;

  const cleanFileId = fileId.trim();
  try {
    const privateKey = getPrivateKey();
    const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

    console.log(`[imagekit] Attempting deletion of fileId: ${cleanFileId}`);
    const response = await fetch(`https://api.imagekit.io/v1/files/${cleanFileId}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
      },
    });

    if (response.ok || response.status === 204 || response.status === 404) {
      console.log(`[imagekit] Deleted or already clean fileId ${cleanFileId} (HTTP ${response.status})`);
    } else {
      const errText = await response.text().catch(() => "");
      console.warn(`[imagekit] Delete response HTTP ${response.status} for fileId ${cleanFileId}: ${errText}`);
    }
  } catch (error) {
    console.error("[imagekit] Error deleting file from ImageKit:", cleanFileId, error);
  }
}
