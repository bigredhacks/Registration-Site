import type { MultipleChoiceGridFormField, PreferenceGridFormField } from "@/lib/formConfig";

interface ChoiceGridProps {
  field: MultipleChoiceGridFormField | PreferenceGridFormField;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  error?: string;
}

export default function ChoiceGrid({ field, value, onChange, error }: ChoiceGridProps) {
  const select = (row: string, column: string) => onChange({ ...value, [row]: column });

  return (
    <fieldset className="min-w-0 w-full rounded-lg bg-white px-3 py-4 sm:px-6 sm:py-6">
      <legend className="float-left mb-2.5 w-full text-sm text-black">
        {field.label} {field.required && <span className="text-red4">*</span>}
      </legend>
      {field.description && <p className="clear-both mb-2 text-xs text-gray-600">{field.description}</p>}

      {/* Both layouts edit the same answers, so resizing never resets a choice. */}
      <div className="clear-both space-y-4 sm:hidden">
        {field.rows.map((row) => (
          <label key={row} className="flex flex-col gap-1.5 text-sm font-medium text-gray-900">
            {row}
            <select
              value={value[row] ?? ""}
              onChange={(event) => select(row, event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base font-normal"
            >
              <option value="" disabled>Select</option>
              {field.columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div className="clear-both hidden w-full overflow-x-auto sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-50 p-2"><span className="sr-only">Category</span></th>
              {field.columns.map((column) => (
                <th scope="col" key={column} className="border border-gray-300 bg-gray-50 p-2 text-center text-sm font-medium text-gray-900">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map((row) => (
              <tr key={row}>
                <th scope="row" className="border border-gray-300 p-2 text-left text-sm font-medium text-gray-900">{row}</th>
                {field.columns.map((column) => (
                  <td key={column} className="border border-gray-300 text-center">
                    <button
                      type="button"
                      aria-label={`${row}: ${column}`}
                      aria-pressed={value[row] === column}
                      onClick={() => select(row, column)}
                      className="mx-auto flex min-h-11 w-full min-w-11 items-center justify-center"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border bg-white ${value[row] === column ? "border-red4" : "border-[#9c9494]"}`}>
                        {value[row] === column && <span className="h-3 w-3 rounded-full bg-red4" />}
                      </span>
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
}
