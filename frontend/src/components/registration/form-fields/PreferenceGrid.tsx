import type { PreferenceGridFormField } from "@/lib/formConfig";

interface PreferenceGridProps {
  field: PreferenceGridFormField;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  error?: string;
}

export default function PreferenceGrid({ field, value, onChange, error }: PreferenceGridProps) {
  const handleSelect = (row: string, column: string) => {
    onChange({
      ...value,
      [row]: column,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 items-start bg-white px-6 py-6 rounded-lg w-full">
      <div className="flex gap-1 items-center w-full">
        <label className="text-sm font-normal text-black leading-[1.5]">
          {field.label}
        </label>
        {field.required && (
          <span className="text-[#fe1736] text-[15px] leading-[normal]">*</span>
        )}
      </div>
      {field.description && (
        <p className="text-xs text-gray-600 mb-2">{field.description}</p>
      )}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2 bg-gray-50 text-left text-sm font-medium text-gray-900"></th>
              {field.columns.map((column) => (
                <th key={column} className="border border-gray-300 p-2 bg-gray-50 text-center text-sm font-medium text-gray-900">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map((row) => (
              <tr key={row}>
                <td className="border border-gray-300 p-2 text-sm font-medium text-gray-900">{row}</td>
                {field.columns.map((column) => (
                  <td key={`${row}-${column}`} className="border border-gray-300 p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleSelect(row, column)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center mx-auto ${
                        value[row] === column
                          ? "border-[#fe1736] bg-white"
                          : "border-[#9c9494] bg-white"
                      }`}
                    >
                      {value[row] === column && (
                        <div className="w-3 h-3 rounded-full bg-[#fe1736]" />
                      )}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
