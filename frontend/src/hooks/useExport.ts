import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reloadData, getPdfUrl, getProjects } from '@/api';
import { useFilters } from './useFilters';

/** RFC 4180 — 쉼표/개행/따옴표가 포함된 필드를 안전하게 인용 (H-4) */
const csvField = (v: unknown): string => {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const useExport = () => {
  const { filters } = useFilters();
  const qc = useQueryClient();

  const exportCsv = async () => {
    try {
      const rows = await getProjects(filters);
      const headers = ['프로젝트코드','연도','파트','단계','매출','지출','직접원가','인건비','공통원가','경상이익','이익율','비고'];
      const lines = [
        headers.map(csvField).join(','),
        ...rows.map(r =>
          [r.project_code, r.year, r.part, r.stage,
           r.revenue, r.expenditure, r.direct_cost, r.labor_cost,
           r.overhead, r.operating_profit, r.profit_rate, r.note]
          .map(csvField).join(',')
        ),
      ];
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `재무현황_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      // H-2: revokeObjectURL을 비동기로 — 다운로드 완료 후 해제
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[CSV Export]', err);
      alert('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  // H-3: window.location.href 대신 target="_blank" — SPA 언마운트 방지
  const exportPdf = () => {
    const a = document.createElement('a');
    a.href = getPdfUrl(filters);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const reloadMutation = useMutation({
    mutationFn: reloadData,
    onSuccess: () => {
      // M-9: 필요한 쿼리만 무효화 (전체 캐시 날리지 않음)
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects-all'] });
    },
    onError: (err) => {
      console.error('[Reload]', err);
    },
  });

  return { exportCsv, exportPdf, reload: reloadMutation.mutate, isReloading: reloadMutation.isPending };
};
