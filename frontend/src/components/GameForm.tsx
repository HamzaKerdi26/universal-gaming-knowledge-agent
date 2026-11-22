import { type FormEvent, useState } from "react";
import {
  type GameFormErrors,
  type GameFormValues,
  validateGameForm,
} from "../utils/gameValidation";

interface GameFormProps {
  initialValues: GameFormValues;
  submitLabel: string;
  submitting: boolean;
  apiError: string | null;
  onSubmit: (values: GameFormValues) => void;
}

export function GameForm({
  initialValues,
  submitLabel,
  submitting,
  apiError,
  onSubmit,
}: GameFormProps) {
  const [values, setValues] = useState<GameFormValues>(initialValues);
  const [errors, setErrors] = useState<GameFormErrors>({});

  function handleChange<K extends keyof GameFormValues>(
    field: K,
    value: GameFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validateGameForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <form className="game-form" onSubmit={handleSubmit} noValidate>
      {apiError && (
        <div className="form-api-error" role="alert">
          {apiError}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={values.title}
          onChange={(e) => handleChange("title", e.target.value)}
          maxLength={200}
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="slug">Slug *</label>
        <input
          id="slug"
          type="text"
          value={values.slug}
          onChange={(e) => handleChange("slug", e.target.value)}
          placeholder="e.g. cyberpunk-2077"
          maxLength={200}
        />
        {errors.slug && <span className="field-error">{errors.slug}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => handleChange("description", e.target.value)}
          maxLength={5000}
        />
        {errors.description && (
          <span className="field-error">{errors.description}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="releaseDate">Release date</label>
          <input
            id="releaseDate"
            type="date"
            value={values.releaseDate}
            onChange={(e) => handleChange("releaseDate", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="developer">Developer</label>
          <input
            id="developer"
            type="text"
            value={values.developer}
            onChange={(e) => handleChange("developer", e.target.value)}
            maxLength={200}
          />
          {errors.developer && (
            <span className="field-error">{errors.developer}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="publisher">Publisher</label>
          <input
            id="publisher"
            type="text"
            value={values.publisher}
            onChange={(e) => handleChange("publisher", e.target.value)}
            maxLength={200}
          />
          {errors.publisher && (
            <span className="field-error">{errors.publisher}</span>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
