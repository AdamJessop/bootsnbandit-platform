"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseSiteForm } from "./site-form";

/**
 * Save SiteSettings (J8). Owner-only. Single settings row keyed by the unique
 * `studioName`, so we upsert. Ticker lines are stored as a string array.
 */
export async function saveSite(fd: FormData): Promise<void> {
  await requireRole("OWNER");
  const v = parseSiteForm(fd);
  const data = {
    studioName: v.studioName,
    addressLine: v.addressLine,
    city: v.city,
    county: v.county,
    postcode: v.postcode,
    hoursText: v.hoursText,
    phone: v.phone,
    email: v.email,
    licensingText: v.licensingText,
    facebookUrl: v.facebookUrl,
    instagramUrl: v.instagramUrl,
    tickerLines: v.tickerLines,
    enquiriesOpen: v.enquiriesOpen,
    visualDirection: v.visualDirection,
  };
  await prisma.siteSettings.upsert({
    where: { studioName: v.studioName },
    create: data,
    update: data,
  });
  revalidatePath("/admin/content/site");
}
