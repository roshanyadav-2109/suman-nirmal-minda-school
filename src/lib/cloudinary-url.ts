// Ask Cloudinary for a resized, compressed copy of an uploaded image by adding
// a transformation to its address, e.g. a 640-wide card thumbnail instead of
// the full photo a phone took. Safe to use anywhere: it only rewrites a URL.
export function cldImage(url: string, transform: string): string {
  return url.includes("/image/upload/") ? url.replace("/image/upload/", `/image/upload/${transform}/`) : url;
}
