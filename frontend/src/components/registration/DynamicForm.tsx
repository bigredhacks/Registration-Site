import { useState } from "react";
import type { FormConfig, FormField } from "@/lib/formConfig";
import TextInput from "./form-fields/TextInput";
import Dropdown from "./form-fields/Dropdown";
import RadioGroup from "./form-fields/RadioGroup";
import Checkbox from "./form-fields/Checkbox";
import CheckboxGroup from "./form-fields/CheckboxGroup";
import FileUpload from "./form-fields/FileUpload";
import MultipleChoiceGrid from "./form-fields/MultipleChoiceGrid";
import PreferenceGrid from "./form-fields/PreferenceGrid";

interface DynamicFormProps {
  config: FormConfig;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  isLoading?: boolean;
  initialValues?: Record<string, unknown>;
  hideHeader?: boolean;
}

export default function DynamicForm({ config, onSubmit, isLoading = false, initialValues = {}, hideHeader = false }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const result = config.schema.safeParse(formData);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "form");
        if (!newErrors[field]) newErrors[field] = issue.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      field,
      error: errors[field.id],
    };
    const value = formData[field.id];
    const stringValue = typeof value === "string" ? value : "";
    const booleanValue = typeof value === "boolean" ? value : false;
    const stringArrayValue = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
    const recordValue =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, string>)
        : {};
    const fileValue =
      value instanceof File ||
      (Array.isArray(value) && value.every((item) => item instanceof File))
        ? value
        : null;

    switch (field.type) {
      case "text":
      case "email":
        return (
          <TextInput
            {...commonProps}
            field={field}
            value={stringValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "dropdown":
        return (
          <Dropdown
            {...commonProps}
            field={field}
            value={stringValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "radio":
        return (
          <RadioGroup
            {...commonProps}
            field={field}
            value={stringValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "checkbox":
        return (
          <Checkbox
            {...commonProps}
            field={field}
            value={booleanValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "checkboxGroup":
        return (
          <CheckboxGroup
            {...commonProps}
            field={field}
            value={stringArrayValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "file":
        return (
          <FileUpload
            {...commonProps}
            field={field}
            value={fileValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "multipleChoiceGrid":
        return (
          <MultipleChoiceGrid
            {...commonProps}
            field={field}
            value={recordValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case "preferenceGrid":
        return (
          <PreferenceGrid
            {...commonProps}
            field={field}
            value={recordValue}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {!hideHeader && (
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-jersey10 text-gray-900">
            BigRed<span className="text-red5">//</span>Hacks
          </h1>
          {config.title && (
            <h2 className="mt-3 text-xl font-poppins font-semibold text-gray-700">{config.title}</h2>
          )}
          {config.description && (
            <p className="mt-1 font-poppins text-sm text-gray-500">{config.description}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {config.fields.map((field) => (
          <div key={field.id}>{renderField(field)}</div>
        ))}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-red5 px-4 py-3 text-sm font-poppins font-semibold text-white shadow-sm hover:bg-red3 focus:outline-none focus:ring-2 focus:ring-red5 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors"
          >
            {isLoading ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </form>
    </div>
  );
}
