import { useState, useRef, useCallback, useEffect } from 'react';
import { debounce } from 'lodash-es';

export interface DebouncedSearch {
  inputValue:   string;
  debouncedValue: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/** 입력 UI state와 실제 검색 filter value를 delay(ms)로 분리하는 범용 훅 */
export const useDebouncedSearch = (delay = 350): DebouncedSearch => {
  const [inputValue,    setInputValue]    = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  const debouncedSet = useRef(debounce(setDebouncedValue, delay)).current;

  useEffect(() => () => debouncedSet.cancel(), [debouncedSet]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    debouncedSet(e.target.value);
  }, [debouncedSet]);

  return { inputValue, debouncedValue, handleChange };
};
