import { Button } from '../Button';
import { confirmDialog } from '@/utils/dialog';

interface Props {
  /** 서버가 파일을 만들어 내려주는 주소 — 호출부(ViewModel)가 정함 */
  href: string;
  label?: string;
  /** 확인창 본문 */
  confirmText: string;
  title?: string;
}

/** 확인창 → 임시 <a download>로 받기. 다른 다운로드(Raw Data·CSV)와 같은 "받으시겠습니까?" 흐름 */
export const HrefDownloadButton = ({ href, label = '↓ 엑셀', confirmText, title }: Props) => {
  const onClick = async () => {
    const ok = await confirmDialog(confirmText, { title: '엑셀을 다운로드하시겠습니까?', confirmText: '다운로드' });
    if (!ok) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  return (
    <Button variant="success" size="sm" onClick={onClick} title={title}>
      {label}
    </Button>
  );
};
