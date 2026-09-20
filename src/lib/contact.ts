/**
 * A wa.me link from a display number. wa.me wants digits only, while
 * `about.json` writes the number the way it should read on the page.
 */
export function whatsappUrl(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}
