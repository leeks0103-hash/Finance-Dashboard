import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reloadData, getPdfUrl, getProjects } from '@/api';
import { useFilters } from './useFilters';

/** RFC 4180 — 쉼표/개행/따옴표가 포함된 필드를 안전하게 인용 */
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[CSV Export]', err);
      alert('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  /**
   * PDF는 서버에서 reportlab으로 생성하므로 시간이 걸림.
   * fetch()로 받아서 모달 로딩 상태를 제공하고, 완료 후 blob 다운로드.
   */
  const exportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await fetch(getPdfUrl(filters));
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `재무현황_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[PDF Export]', err);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const reloadMutation = useMutation({
    mutationFn: reloadData,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects-all'] });
    },
    onError: (err) => {
      console.error('[Reload]', err);
    },
  });

  return {
    exportCsv,
    exportPdf,
    isExportingPdf,
    reload: reloadMutation.mutate,
    isReloading: reloadMutation.isPending,
  };
};
