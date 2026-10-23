import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from './AdminRoute';

// 가드는 store(adminAuthed)와 서버 설정(loginRequired)만 본다 — 둘 다 가짜로 바꿔 끼움
const state = { adminAuthed: false, loginRequired: true };
vi.mock('@/store', () => ({ useUiStore: (sel: (s: { adminAuthed: boolean }) => unknown) => sel({ adminAuthed: state.adminAuthed }) }));
vi.mock('@/hooks/useLoginRequired', () => ({ useLoginRequired: () => ({ loginRequired: state.loginRequired, isLoading: false }) }));
vi.mock('./AdminLogin', () => ({ default: () => <div>관리자 로그인 폼</div> }));

const renderAt = (authChecking = false) => render(
  <MemoryRouter initialEntries={['/admin/settings']}>
    <Routes>
      <Route path="/performance" element={<div>실적 첫 화면</div>} />
      <Route path="/admin/*" element={<AdminRoute authChecking={authChecking}><div>관리자 페이지</div></AdminRoute>} />
    </Routes>
  </MemoryRouter>,
);

describe('AdminRoute — #/admin 접근 제한', () => {
  beforeEach(() => { state.adminAuthed = false; state.loginRequired = true; });

  it('관리자면 페이지를 보여준다', () => {
    state.adminAuthed = true;
    renderAt();
    expect(screen.getByText('관리자 페이지')).toBeInTheDocument();
  });

  it('관리자가 아니고 로그인 요구가 켜져 있으면 첫 화면(실적)으로 돌려보낸다', () => {
    renderAt();
    expect(screen.getByText('실적 첫 화면')).toBeInTheDocument();
    expect(screen.queryByText('관리자 페이지')).toBeNull();
  });

  it('로그인 요구가 꺼져 있으면(로그인 화면이 없으면) 관리자 로그인 폼을 보여준다', () => {
    state.loginRequired = false;
    renderAt();
    expect(screen.getByText('관리자 로그인 폼')).toBeInTheDocument();
  });

  it('저장된 로그인을 확인하는 중에는 아무것도 안 그리고 쫓아내지도 않는다', () => {
    const { container } = renderAt(true);
    expect(container).toBeEmptyDOMElement();
  });

  it('확인이 끝나기 전이라도 이미 관리자로 확인됐다면 페이지를 바로 보여준다', () => {
    state.adminAuthed = true;
    renderAt(true);
    expect(screen.getByText('관리자 페이지')).toBeInTheDocument();
  });
});
