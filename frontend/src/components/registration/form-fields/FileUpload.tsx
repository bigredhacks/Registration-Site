import { useState, useRef } from "react";
import type { FileFormField } from "@/lib/formConfig";

interface FileUploadProps {
  field: FileFormField;
  value: File | File[] | null;
  onChange: (value: File | File[] | null) => void;
  error?: string;
}

export default function FileUpload({ field, value, onChange, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (field.multiple) {
        onChange(files);
      } else {
        onChange(files[0]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (field.multiple) {
        onChange(Array.from(files));
      } else {
        onChange(files[0]);
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getFileName = () => {
    if (!value) return null;
    if (Array.isArray(value)) {
      return value.map((f) => f.name).join(", ");
    }
    return value.name;
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
        <p className="text-xs text-gray-600">{field.description}</p>
      )}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`w-full border-[3px] border-dashed rounded-lg flex items-center justify-center py-32 cursor-pointer transition-colors ${
          isDragging ? "border-[#fe1736] bg-red-50" : "border-[#af3532] bg-white"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id={field.id}
          name={field.id}
          onChange={handleFileChange}
          accept={field.accept}
          multiple={field.multiple}
          className="hidden"
          required={field.required}
        />
        <p className="text-xs font-normal text-neutral-900 text-center whitespace-pre-wrap">
          {getFileName() || "Drop File Here"}
        </p>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
