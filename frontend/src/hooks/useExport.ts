import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reloadData, getPdfUrl, getProjects } from '@/api';
import { reloadKpiData } from '@/api/kpi.api';
import { reloadPerfData } from '@/api/performance.api';
import { useFilters } from './useFilters';
import { useUiStore } from '@/store';

// 브라우저가 다운로드를 시작할 시간을 번 뒤 blob URL 해제 — 너무 빨리 해제하면 일부 브라우저에서 다운로드 실패
const BLOB_URL_REVOKE_DELAY_MS = 1000;
// 이보다 오래 걸릴 때만 로딩 모달 표시 — 짧은 다운로드에서 모달이 번쩍이는 것 방지
const PDF_MODAL_DELAY_MS = 300;

/** RFC 4180 — 쉼표/개행/따옴표가 포함된 필드를 안전하게 인용 */
const csvField = (v: unknown): string => {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/** 헤더+행 데이터로 CSV 파일을 생성해 즉시 다운로드 — 재무/KPI/실적 3탭 CSV 내보내기 공용 */
export const downloadCsvFile = (filename: string, headers: string[], rows: unknown[][]): void => {
  const lines = [
    headers.map(csvField).join(','),
    ...rows.map(r => r.map(csvField).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS);
};

export const useExport = () => {
  const { filters } = useFilters();
  const qc = useQueryClient();
  const setLastLoaded = useUiStore(s => s.setLastLoaded);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  // PDF_MODAL_DELAY_MS 이상 걸릴 때만 모달 표시 — 짧은 다운로드에서 번쩍임 방지
  const [showModal, setShowModal] = useState(false);
  const [correctedRows, setCorrectedRows] = useState<number>(0);

  const exportCsv = async () => {
    try {
      const { data: rows } = await getProjects(filters, { page: 1, pageSize: 9999, search: '' });
      const headers = ['프로젝트코드','연도','파트','단계','매출','지출','직접원가','인건비','공통원가','경상이익','이익율','노트'];
      downloadCsvFile(
        `재무현황_${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows.map(r => [r.project_code, r.year, r.part, r.stage,
           r.revenue, r.expenditure, r.direct_cost, r.labor_cost,
           r.overhead, r.operating_profit, r.profit_rate, r.note]),
      );
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

    const timer = setTimeout(() => setShowModal(true), PDF_MODAL_DELAY_MS);

    try {
      const res = await fetch(getPdfUrl(filters));
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

      // content-type 검증 — PDF가 아니면 에러
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/pdf')) {
        throw new Error(`PDF가 아닌 응답: ${ct}`);
      }

      // arrayBuffer → 명시적 application/pdf Blob 생성 (MIME 타입 보장)
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // DOM에 anchor 추가해야 일부 브라우저에서 download 속성 동작
      const a = document.createElement('a');
      a.href = url;
      a.download = `재무현황_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS);
    } catch (err) {
      console.error('[PDF Export]', err);
      alert(`PDF 생성 중 오류가 발생했습니다.\n${err instanceof Error ? err.message : ''}`);
    } finally {
      clearTimeout(timer);
      setIsExportingPdf(false);
      setShowModal(false);
    }
  };

  const reloadMutation = useMutation({
    mutationFn: async () => {
      // 재무·KPI·실적 세 캐시 동시 갱신
      const [finance] = await Promise.all([
        reloadData(),
        reloadKpiData().catch(() => null),
        reloadPerfData().catch(() => null),
      ]);
      return finance;
    },
    onSuccess: (data) => {
      // 전체 TanStack Query 캐시 무효화 → 모든 탭 즉시 재요청
      qc.invalidateQueries();
      if (data.ok) {
        const ts = data.loaded_at ?? '';
        const shortTs = ts.length >= 16 ? ts.slice(5, 16).replace('T', ' ') : ts;
        setLastLoaded(shortTs || null);
        setCorrectedRows(data.corrected_rows);
      }
    },
    onError: (err) => {
      console.error('[Reload]', err);
    },
  });

  return {
    exportCsv,
    exportPdf,
    isExportingPdf,
    showPdfModal: showModal,  // PDF_MODAL_DELAY_MS 지연 후 true — 모달 표시 여부
    reload: reloadMutation.mutate,
    isReloading: reloadMutation.isPending,
    correctedRows,
  };
};
