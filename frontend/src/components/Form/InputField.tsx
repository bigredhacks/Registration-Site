type InputFieldProps = {
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
};

const InputField: React.FC<InputFieldProps> = ({
  label,
  placeholder,
  type = "text",
  required = false,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-brown-light">
        {label} {required && <span className="text-red-medium">*</span>}
      </label>
      <div className="mt-1">
        <input
          type={type}
          required={required}
          className="w-full px-3 py-2 border border-brown-medium rounded-md shadow-sm text-sm placeholder-brown-transparent focus:outline-none focus:ring-brown-dark focus:border-brown-dark"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

export default InputField;
