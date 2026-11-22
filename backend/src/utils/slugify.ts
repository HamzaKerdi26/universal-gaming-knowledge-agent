// Converts arbitrary text into a lowercase, hyphen-separated slug
// matching this project's existing slug convention (see
// src/types/game.ts's createGameSchema regex: ^[a-z0-9]+(-[a-z0-9]+)*$).
// Used by data sources whose external records don't already come with a
// slug of their own (RAWG provides one; a Wikipedia page title does not).
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
