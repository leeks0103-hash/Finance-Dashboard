import { useState, useRef, useCallback, useEffect } from 'react';
import { debounce } from 'lodash-es';

export interface DebouncedSearch {
  inputValue:     string;
  debouncedValue: string;
  handleChange:   (e: React.ChangeEvent<HTMLInputElement>) => void;
  reset:          () => void;
}

export const useDebouncedSearch = (delay = 350): DebouncedSearch => {
  const [inputValue,     setInputValue]     = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  const debouncedSet = useRef(debounce(setDebouncedValue, delay)).current;

  useEffect(() => () => debouncedSet.cancel(), [debouncedSet]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    debouncedSet(e.target.value);
  }, [debouncedSet]);

  const reset = useCallback(() => {
    debouncedSet.cancel();
    setInputValue('');
    setDebouncedValue('');
  }, [debouncedSet]);

  return { inputValue, debouncedValue, handleChange, reset };
};
