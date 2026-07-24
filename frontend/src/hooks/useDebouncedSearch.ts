import { useState, useRef, useCallback, useEffect } from 'react';
import type { SetStateAction } from 'react';
import { debounce } from 'lodash-es';

export interface DebouncedSearch {
  inputValue:     string;
  debouncedValue: string;
  handleChange:   (e: React.ChangeEvent<HTMLInputElement>) => void;
  reset:          () => void;
  /** React.Dispatch<SetStateAction<string>> 호환 — TanStack Table의 함수형 updater도 처리 */
  setFilter:      React.Dispatch<SetStateAction<string>>;
}

export const useDebouncedSearch = (delay = 350): DebouncedSearch => {
  const [inputValue,     setInputValue]     = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const inputRef = useRef(inputValue);
  inputRef.current = inputValue;

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

  // React.Dispatch<SetStateAction<string>> 호환 — string 또는 함수 updater 모두 처리
  const setFilter = useCallback((action: SetStateAction<string>) => {
    const next = typeof action === 'function' ? action(inputRef.current) : action;
    debouncedSet.cancel();
    setInputValue(next);
    setDebouncedValue(next);
  }, [debouncedSet]);

  return { inputValue, debouncedValue, handleChange, reset, setFilter };
};
