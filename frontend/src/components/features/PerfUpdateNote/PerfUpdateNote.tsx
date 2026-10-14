import { useUiStore } from '@/store/ui.store';
import { usePerfUpdateNote } from '@/hooks/usePerfUpdateNote';
import { UpdateDateField } from '@/components/ui';

/** 실적 탭 필터바 오른쪽 끝 — 라벨·날짜는 서버 저장(모두 같은 값), 관리자만 고침. 일반 회원은 글자로만 */
const PerfUpdateNote = () => {
  const isAdmin = useUiStore(s => s.adminAuthed);
  const { value, update } = usePerfUpdateNote();
  return (
    <UpdateDateField
      editable={isAdmin}
      label={value.label}
      onLabelChange={label => update({ label })}
      value={value.note}
      onChange={note => update({ note })}
    />
  );
};

export default PerfUpdateNote;
