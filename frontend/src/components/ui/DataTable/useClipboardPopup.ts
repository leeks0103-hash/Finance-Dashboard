import { useCallback, useState } from 'react';

interface PopupState {
  text:      string;
  copyable:  boolean;
  /** 제공 시 팝업에 "↗ 바로가기" 버튼 노출 (예: 파일명 → 원본 PPT 열기) */
  onOpen?:   () => void;
}

/** 셀 내용 팝업 + 클립보드 복사 — DataTable·KpiRawTable 공용 */
export const useClipboardPopup = () => {
  const [popup,  setPopup]  = useState<PopupState | null>(null);
  const [copied, setCopied] = useState(false);

  const openPopup = useCallback((text: string, copyable = false, onOpen?: () => void) => {
    setPopup({ text, copyable, onOpen });
    setCopied(false);
  }, []);

  const closePopup = useCallback(() => setPopup(null), []);

  const copyPopupText = useCallback(async () => {
    if (!popup) return;
    try {
      await navigator.clipboard.writeText(popup.text);
    } catch {
      const el = document.createElement('textarea');
      el.value = popup.text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [popup]);

  return { popup, copied, openPopup, closePopup, copyPopupText };
};
