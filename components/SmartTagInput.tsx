import React from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import { api } from '../api';

interface TagOption {
  value: string;
  label: string;
}

interface SmartTagInputProps {
  value: { tag: string; weight: number }[];
  onChange: (tags: { tag: string; weight: number }[]) => void;
  placeholder?: string;
}

const customStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: 'var(--background)',
    borderColor: 'var(--input)',
    borderRadius: '0.5rem', // rounded-lg
    boxShadow: state.isFocused ? '0 0 0 1px var(--primary)' : 'none',
    '&:hover': {
      borderColor: 'var(--primary)',
    },
    padding: '2px',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: 'var(--card)',
    zIndex: 9999,
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isFocused ? 'var(--muted)' : 'var(--card)',
    color: 'var(--foreground)',
    cursor: 'pointer',
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: 'var(--muted)',
    borderRadius: '0.25rem',
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: 'var(--foreground)',
    fontWeight: 500,
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    color: 'var(--muted-foreground)',
    ':hover': {
      backgroundColor: 'var(--destructive)',
      color: 'white',
    },
  }),
  input: (provided: any) => ({
    ...provided,
    color: 'var(--foreground)',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  }),
};

const SmartTagInput: React.FC<SmartTagInputProps> = ({ value, onChange, placeholder }) => {
  const loadOptions = async (inputValue: string) => {
    if (!inputValue || inputValue.length < 2) return [];
    try {
      const results = await api.searchTags(inputValue);
      return results.map((tag: any) => ({ value: tag.value, label: tag.label }));
    } catch (e) {
      console.error("Failed to load tags", e);
      return [];
    }
  };

  const handleChange = (newValue: any) => {
    // newValue is array of {value, label, __isNew__}
    const tags = newValue.map((option: any) => ({
      tag: option.value, // react-select passes the string value here
      weight: option.__isNew__ ? 3 : 5, // Default weight for manually added tags vs existing ones
    }));
    onChange(tags);
  };

  // Convert current internal tag structure to react-select options
  const selectedOptions = value.map(t => ({ value: t.tag, label: t.tag }));

  return (
    <div>
      <AsyncCreatableSelect
        cacheOptions
        defaultOptions
        isMulti
        loadOptions={loadOptions}
        onChange={handleChange}
        value={selectedOptions}
        placeholder={placeholder || "Type to search or create tags..."}
        styles={customStyles}
        formatCreateLabel={(inputValue) => `Create "${inputValue}" (will be normalized)`}
        classNamePrefix="react-select"
      />
      <p className="text-[10px] text-muted-foreground mt-1 ml-1">
        New tags are automatically converted to lowercase singular (e.g. "Sneakers" → "sneaker").
      </p>
    </div>
  );
};

export default SmartTagInput;
