import { useCallback, useState } from 'react';

interface PopupState {
  text:      string;
  copyable:  boolean;
  /** 제공 시 팝업에 "↗ 바로가기" 버튼 노출 (예: 파일명 → 원본 PPT 열기) */
  onOpen?:   () => void;
  /** 제공 시 "폴더 열기" 버튼도 — 파일이 든 폴더(2026-10-06) */
  onOpenFolder?: () => unknown;
  /** 팝업 제목 — 클릭한 셀의 컬럼 이름(파일명·비고 등). 없으면 CellPopup의 title prop */
  title?:    string;
}

/** 셀 내용 팝업 + 클립보드 복사 — DataTable·KpiRawTable 공용 */
export const useClipboardPopup = () => {
  const [popup,  setPopup]  = useState<PopupState | null>(null);
  const [copied, setCopied] = useState(false);

  const openPopup = useCallback((text: string, copyable = false, onOpen?: () => void, title?: string, onOpenFolder?: () => unknown) => {
    setPopup({ text, copyable, onOpen, title, onOpenFolder });
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
