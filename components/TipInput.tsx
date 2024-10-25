import React from 'react';

interface TipInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const TipInput: React.FC<TipInputProps> = ({ label, value, onChange }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700">{label} (%)</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min="0"
        max="100"
        step="0.1"
        className="mt-1 block w-full px-3 py-2 rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
    </div>
  );
};

export default TipInput;
