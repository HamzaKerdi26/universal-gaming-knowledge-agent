export interface GameFormValues {
  title: string;
  slug: string;
  description: string;
  releaseDate: string; // yyyy-mm-dd from a <input type="date">, or ""
  developer: string;
  publisher: string;
}

export type GameFormErrors = Partial<Record<keyof GameFormValues, string>>;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Mirrors src/types/game.ts's createGameSchema on the backend as closely
// as practical, so users get the same feedback before ever hitting the API.
export function validateGameForm(values: GameFormValues): GameFormErrors {
  const errors: GameFormErrors = {};

  const title = values.title.trim();
  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > 200) {
    errors.title = "Title must be 200 characters or fewer.";
  }

  const slug = values.slug.trim();
  if (!slug) {
    errors.slug = "Slug is required.";
  } else if (slug.length > 200) {
    errors.slug = "Slug must be 200 characters or fewer.";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug =
      "Slug must be lowercase letters, numbers, and hyphens only (e.g. cyberpunk-2077).";
  }

  if (values.description.trim().length > 5000) {
    errors.description = "Description must be 5000 characters or fewer.";
  }

  if (values.developer.trim().length > 200) {
    errors.developer = "Developer must be 200 characters or fewer.";
  }

  if (values.publisher.trim().length > 200) {
    errors.publisher = "Publisher must be 200 characters or fewer.";
  }

  // The date input already constrains the format to yyyy-mm-dd; nothing
  // further to validate client-side. It's converted to a full ISO
  // datetime (e.g. 2020-12-10T00:00:00Z) before being sent to the API,
  // since the backend requires a full ISO datetime string.

  return errors;
}

export function toGameInput(values: GameFormValues) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || undefined,
    releaseDate: values.releaseDate
      ? `${values.releaseDate}T00:00:00Z`
      : undefined,
    developer: values.developer.trim() || undefined,
    publisher: values.publisher.trim() || undefined,
  };
}
