import React from 'react';

interface SlippageInputProps {
  value: number;
  onChange: (value: number) => void;
  customStyles?: Record<string, string>;
}

const SlippageInput: React.FC<SlippageInputProps> = ({ value, onChange, customStyles = {} }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
      onChange(newValue);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300">
        Slippage Tolerance (%)
      </label>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        min="0"
        max="100"
        step="0.1"
        className={customStyles.input || "mt-1 block w-full bg-gray-700 text-white rounded-lg px-3 py-2"}
      />
    </div>
  );
};

export default SlippageInput;
