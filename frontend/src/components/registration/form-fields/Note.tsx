import type { NoteFormField } from "@/lib/formConfig";

interface NoteProps {
  field: NoteFormField;
}

// Display-only informational note. Renders the label as a bold notice with an
// optional description below. No input, no value.
export default function Note({ field }: NoteProps) {
  return (
    <div className="w-full rounded-lg border border-red5/30 bg-red7 px-6 py-4">
      <p className="font-poppins text-sm font-bold text-red6">{field.label}</p>
      {field.description && (
        <p className="mt-1 font-poppins text-sm text-gray-700">{field.description}</p>
      )}
    </div>
  );
}
