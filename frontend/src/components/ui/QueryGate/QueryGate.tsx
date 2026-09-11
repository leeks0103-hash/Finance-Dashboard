import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface Props {
  /** 첫 로딩 (아직 데이터 없음) — true면 loadingView */
  loading:      boolean;
  /** 로딩 끝났는데 표시할 데이터가 없음 / 사용 불가 — true면 emptyView */
  empty?:       boolean;
  /** 조회 실패 — true면 errorView */
  error?:       boolean;
  loadingView?: ReactNode;
  emptyView?:   ReactNode;
  errorView?:   ReactNode;
  children:     ReactNode;
}

/**
 * 로딩 / 에러 / 빈 상태 / 정상 을 한 곳에서 분기 — 우선순위: loading > error > empty > children.
 * "로딩 중인데 '데이터 없음' 화면이 먼저 뜨는" 실수를 구조적으로 막는다.
 * (react-query useQuery는 non-suspense라 Suspense fallback이 데이터 로딩을 못 잡음 —
 *  페이지마다 이 게이트로 상태를 선언한다.)
 */
export const QueryGate = ({
  loading, empty = false, error = false,
  loadingView = <Spinner />, emptyView = null, errorView = null,
  children,
}: Props) => {
  if (loading) return <>{loadingView}</>;
  if (error)   return <>{errorView}</>;
  if (empty)   return <>{emptyView}</>;
  return <>{children}</>;
};

export default QueryGate;
