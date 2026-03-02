import { prisma } from "@/lib/prisma";
import { getSignedUrl, STORAGE_BUCKETS } from "@/lib/supabase";

export interface EvidenceBundle {
  invoiceId: string;
  compiledAt: string;

  authorization: {
    payerName: string;
    payerIsCustomer: boolean;
    relationshipToCustomer: string | null;
    authorizationText: string;
    disclaimersAccepted: Array<{ text: string; acceptedAt: string }>;
    consentTimestamp: string;
    ipAddress: string | null;
    userAgent: string | null;
    deviceFingerprint: string | null;
  } | null;

  identityVerification: {
    dlFrontImageUrl: string | null;
    dlBackImageUrl: string | null;
    signatureImageUrl: string | null;
    lastFourEntered: string;
    lastFourMatched: boolean | null;
  } | null;

  workDocumentation: {
    beforePhotos: Array<{
      url: string;
      description: string | null;
      takenAt: string | null;
      uploadedAt: string;
    }>;
    duringPhotos: Array<{
      url: string;
      description: string | null;
      takenAt: string | null;
      uploadedAt: string;
    }>;
    afterPhotos: Array<{
      url: string;
      description: string | null;
      takenAt: string | null;
      uploadedAt: string;
    }>;
  };

  shopApproval: {
    decision: string;
    approvedByStaffName: string;
    decidedAt: string;
    notes: string | null;
  } | null;

  invoice: {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    vehicleInfo: Record<string, string> | null;
    lineItems: Array<{
      description: string;
      amountCents: number;
      type: string;
    }>;
    subtotalCents: number;
    convenienceFeeCents: number;
    totalCents: number;
    status: string;
    sentAt: string | null;
    paidAt: string | null;
    createdAt: string;
  };

  shop: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
}

/**
 * Compile a complete evidence bundle for an invoice.
 * Fetches all related data (authorization, work photos, shop approval)
 * and generates signed URLs for all images.
 */
export async function compileEvidenceBundle(
  invoiceId: string
): Promise<EvidenceBundle> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
        },
      },
      authorization: true,
      workPhotos: {
        include: {
          uploadedBy: {
            select: { name: true },
          },
        },
        orderBy: { uploadedAt: "asc" },
      },
      shopApproval: {
        include: {
          approvedBy: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  // Generate signed URLs for authorization images
  let dlFrontImageUrl: string | null = null;
  let dlBackImageUrl: string | null = null;
  let signatureImageUrl: string | null = null;

  if (invoice.authorization) {
    if (invoice.authorization.dlFrontImagePath) {
      dlFrontImageUrl = await getSignedUrl(
        STORAGE_BUCKETS.DL_IMAGES,
        invoice.authorization.dlFrontImagePath
      );
    }
    if (invoice.authorization.dlBackImagePath) {
      dlBackImageUrl = await getSignedUrl(
        STORAGE_BUCKETS.DL_IMAGES,
        invoice.authorization.dlBackImagePath
      );
    }
    if (invoice.authorization.signatureDataPath) {
      signatureImageUrl = await getSignedUrl(
        STORAGE_BUCKETS.SIGNATURES,
        invoice.authorization.signatureDataPath
      );
    }
  }

  // Generate signed URLs for work photos
  const workPhotosByType: Record<
    string,
    Array<{
      url: string;
      description: string | null;
      takenAt: string | null;
      uploadedAt: string;
    }>
  > = {
    BEFORE: [],
    DURING: [],
    AFTER: [],
  };

  for (const photo of invoice.workPhotos) {
    const url = await getSignedUrl(STORAGE_BUCKETS.WORK_PHOTOS, photo.imagePath);
    const photoEntry = {
      url,
      description: photo.description,
      takenAt: photo.takenAt?.toISOString() ?? null,
      uploadedAt: photo.uploadedAt.toISOString(),
    };
    if (workPhotosByType[photo.photoType]) {
      workPhotosByType[photo.photoType].push(photoEntry);
    }
  }

  // Build authorization section
  let authorizationSection: EvidenceBundle["authorization"] = null;
  let identitySection: EvidenceBundle["identityVerification"] = null;

  if (invoice.authorization) {
    const auth = invoice.authorization;
    authorizationSection = {
      payerName: auth.payerName,
      payerIsCustomer: auth.payerIsCustomer,
      relationshipToCustomer: auth.relationshipToCustomer,
      authorizationText: auth.authorizationText,
      disclaimersAccepted: auth.disclaimersAccepted as Array<{
        text: string;
        acceptedAt: string;
      }>,
      consentTimestamp: auth.consentTimestamp.toISOString(),
      ipAddress: auth.ipAddress,
      userAgent: auth.userAgent,
      deviceFingerprint: auth.deviceFingerprint,
    };

    identitySection = {
      dlFrontImageUrl,
      dlBackImageUrl,
      signatureImageUrl,
      lastFourEntered: auth.lastFourEntered,
      lastFourMatched: auth.lastFourMatched,
    };
  }

  // Build shop approval section
  let shopApprovalSection: EvidenceBundle["shopApproval"] = null;
  if (invoice.shopApproval) {
    shopApprovalSection = {
      decision: invoice.shopApproval.decision,
      approvedByStaffName: invoice.shopApproval.approvedBy.name,
      decidedAt: invoice.shopApproval.decidedAt.toISOString(),
      notes: invoice.shopApproval.notes,
    };
  }

  return {
    invoiceId: invoice.id,
    compiledAt: new Date().toISOString(),

    authorization: authorizationSection,
    identityVerification: identitySection,

    workDocumentation: {
      beforePhotos: workPhotosByType.BEFORE,
      duringPhotos: workPhotosByType.DURING,
      afterPhotos: workPhotosByType.AFTER,
    },

    shopApproval: shopApprovalSection,

    invoice: {
      id: invoice.id,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: invoice.customerEmail,
      vehicleInfo: invoice.vehicleInfo as Record<string, string> | null,
      lineItems: invoice.lineItems as Array<{
        description: string;
        amountCents: number;
        type: string;
      }>,
      subtotalCents: invoice.subtotalCents,
      convenienceFeeCents: invoice.convenienceFeeCents,
      totalCents: invoice.totalCents,
      status: invoice.status,
      sentAt: invoice.sentAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
    },

    shop: {
      id: invoice.shop.id,
      name: invoice.shop.name,
      address: invoice.shop.address,
      phone: invoice.shop.phone,
      email: invoice.shop.email,
    },
  };
}
