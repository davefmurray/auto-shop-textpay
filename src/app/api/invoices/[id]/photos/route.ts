import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, STORAGE_BUCKETS } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/invoices/[id]/photos
 * Upload work photos for an invoice.
 * Requires authentication.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the invoice exists and belongs to the shop
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, shopId: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.shopId !== session.user.shopId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const photoType = formData.get("photoType") as
      | "BEFORE"
      | "DURING"
      | "AFTER";
    const descriptionsRaw = formData.get("descriptions") as string | null;
    const photos = formData.getAll("photos") as File[];

    if (!photoType || !["BEFORE", "DURING", "AFTER"].includes(photoType)) {
      return NextResponse.json(
        {
          error:
            'photoType is required and must be one of: BEFORE, DURING, AFTER',
        },
        { status: 400 }
      );
    }

    if (!photos.length) {
      return NextResponse.json(
        { error: "At least one photo file is required" },
        { status: 400 }
      );
    }

    // Parse descriptions array
    let descriptions: string[] = [];
    try {
      descriptions = descriptionsRaw ? JSON.parse(descriptionsRaw) : [];
    } catch {
      descriptions = [];
    }

    // Upload each photo and create WorkPhoto records
    const workPhotos = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      const ext = photo.name.split(".").pop() || "jpg";
      const storagePath = `${invoice.shopId}/${id}/${photoType.toLowerCase()}/${uuidv4()}.${ext}`;

      const uploadedPath = await uploadFile(
        STORAGE_BUCKETS.WORK_PHOTOS,
        storagePath,
        photoBuffer,
        photo.type || "image/jpeg"
      );

      const workPhoto = await prisma.workPhoto.create({
        data: {
          invoiceId: id,
          uploadedByStaffId: session.user.id,
          photoType,
          imagePath: uploadedPath,
          description: descriptions[i] || null,
          takenAt: new Date(),
        },
      });

      workPhotos.push(workPhoto);
    }

    return NextResponse.json({ workPhotos }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices/[id]/photos error:", error);
    return NextResponse.json(
      { error: "Failed to upload photos" },
      { status: 500 }
    );
  }
}
