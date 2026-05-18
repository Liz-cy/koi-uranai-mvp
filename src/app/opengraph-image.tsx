import { buildShareOgImage, ogImageAlt, ogImageSize } from "@/lib/og-share-image";

export const runtime = "edge";

export const alt = ogImageAlt;

export const size = ogImageSize;

export const contentType = "image/png";

export default async function Image() {
  return buildShareOgImage();
}
