import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import Profile from '../pages/Profile/Profile';
import apiClient from '../api/apiClient';

const originalAdapter = apiClient.defaults.adapter;
const originalBridge = window.__uniStudyIU;
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  window.__uniStudyIU = originalBridge;
  localStorage.clear();
});

function fixture({ connected = false, total = null, refresh } = {}) {
  const requests = [];
  let requiredCredits = total > 0 ? 129 : null;
  apiClient.defaults.adapter = async config => {
    requests.push(config);
    const response = data => ({ config, status: 200, headers: {}, data: { success: true, data } });
    if (config.url === '/student/profile') return response({ student_code: 'BSE250001', full_name: 'Credit tester',
      total_passed_credits: 25, total_program_credits: total,
      required_program_credits: requiredCredits, available_block_credits: requiredCredits == null ? null : 203,
      block_earned_credits: requiredCredits == null ? null : 28, academic_summary: { overall: {
        cumulative10: 6.66, cumulative4: 2.52, earnedCredits: 25, subjectCount: 13, completedSubjects: 9,
      }, semesters: [] } });
    if (config.url === '/student/grades' || config.url === '/student/subjects') return response([]);
    if (config.url === '/sync/iu/status') return response({ connected });
    if (config.url === '/sync/iu/group') {
      expect(JSON.parse(config.data)).toEqual({ nhom: 'chuongtrinh', luuDb: true });
      const result = refresh ? await refresh() : { persisted: true, totalProgramCredits: 126 };
      if (result.persisted && result.totalProgramCredits > 0) { total = result.totalProgramCredits; requiredCredits = 129; }
      return response(result);
    }
    throw new Error('Unexpected request ' + config.url);
  };
  const page = render(<MemoryRouter><AppProvider><Profile /></AppProvider></MemoryRouter>);
  return { ...page, requests, groupRequests: () => requests.filter(config => config.url === '/sync/iu/group') };
}

it('automatically loads missing official credits when IU is connected and replaces a personal total', async () => {
  localStorage.setItem('ssh-profile:BSE250001', JSON.stringify({ totalCredits: 150 }));
  const page = fixture({ connected: true });
  const credit = await screen.findByText('25 / 126 tín chỉ');
  expect(within(credit.closest('article')).getByText('20% chương trình')).toBeTruthy();
  expect(page.groupRequests()).toHaveLength(1);
  const blocks = await screen.findByRole('region', { name: 'Tín chỉ theo khối IU' });
  expect(within(blocks).getByText('129', { exact: false })).toBeTruthy();
  expect(within(blocks).getByText('203', { exact: false })).toBeTruthy();
  expect(within(blocks).getByText('28', { exact: false })).toBeTruthy();
  expect(within(credit.closest('article')).getByText('129')).toBeTruthy();
  expect(screen.queryByText('25 / 150 tín chỉ')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Đồng bộ tín chỉ IU' })).toBeNull();
});

it('restores an existing IU session silently without opening login', async () => {
  window.__uniStudyIU = { isAvailable: true, restoreIU: vi.fn().mockResolvedValue({ connected: true }), loginIU: vi.fn() };
  fixture();
  await screen.findByText('25 / 126 tín chỉ');
  expect(window.__uniStudyIU.restoreIU).toHaveBeenCalledOnce();
  expect(window.__uniStudyIU.loginIU).not.toHaveBeenCalled();
});

it('shows why the total is absent and opens login only after the user chooses to sync', async () => {
  window.__uniStudyIU = { isAvailable: true, restoreIU: vi.fn().mockResolvedValue({ connected: false }), loginIU: vi.fn().mockResolvedValue({ ok: true }) };
  const page = fixture();
  await screen.findByText('Chưa kết nối IU để cập nhật tổng tín chỉ chương trình.');
  expect(window.__uniStudyIU.loginIU).not.toHaveBeenCalled();
  expect(screen.getByText('25 tín chỉ')).toBeTruthy();
  expect(page.groupRequests()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tín chỉ IU' }));
  await screen.findByText('25 / 126 tín chỉ');
  expect(window.__uniStudyIU.loginIU).toHaveBeenCalledOnce();
});

it('keeps the manual entry and sync page available without an Electron bridge', async () => {
  window.__uniStudyIU = undefined;
  const page = fixture();
  await screen.findByText('Chưa kết nối IU để cập nhật tổng tín chỉ chương trình.');
  expect(screen.getByRole('link', { name: 'Mở trang Đồng bộ' }).getAttribute('href')).toBe('/sync');
  fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tín chỉ IU' }));
  await screen.findByText('Kết nối IU tại trang Đồng bộ để lấy tổng tín chỉ chương trình.');
  expect(page.groupRequests()).toHaveLength(0);
  const card = screen.getByText('Tín chỉ tích lũy').closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Cập nhật tổng tín chỉ' }));
  expect(screen.getByRole('dialog', { name: 'Mục tiêu học tập' })).toBeTruthy();
});

it('keeps earned credits and avoids a fabricated denominator when IU has no program total', async () => {
  fixture({ connected: true, refresh: async () => ({ persisted: true, totalProgramCredits: null }) });
  await screen.findByText('IU chưa cung cấp tổng tín chỉ chương trình. Bạn có thể thử lại hoặc nhập tổng tín chỉ.');
  expect(screen.getByText('25 tín chỉ')).toBeTruthy();
  expect(screen.queryByText('25 / 126 tín chỉ')).toBeNull();
  expect(screen.getByText('Tín chỉ tích lũy').closest('article').querySelector('.profile-stat-progress')).toBeNull();
});

it('keeps the old data on an expired session or failed persistence and allows retry', async () => {
  let attempts = 0;
  const page = fixture({ connected: true, refresh: async () => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('expired'), { response: { status: 401 } });
    if (attempts === 2) return { persisted: false, totalProgramCredits: 126 };
    return { persisted: true, totalProgramCredits: 126 };
  } });
  await screen.findByText('Phiên IU đã hết hạn. Bấm đồng bộ để kết nối lại.');
  expect(screen.getByText('25 tín chỉ')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tín chỉ IU' }));
  await screen.findByText('Chưa xác nhận được kết quả cập nhật tín chỉ. Hãy thử lại.');
  expect(screen.queryByText('25 / 126 tín chỉ')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tín chỉ IU' }));
  await screen.findByText('25 / 126 tín chỉ');
  expect(page.groupRequests()).toHaveLength(3);
});

it('locks repeated clicks while refreshing credits', async () => {
  let finish;
  const page = fixture({ connected: true, refresh: () => new Promise(resolve => { finish = resolve; }) });
  await waitFor(() => expect(page.groupRequests()).toHaveLength(1));
  const button = screen.getByRole('button', { name: 'Đang cập nhật tín chỉ…' });
  expect(button.disabled).toBe(true);
  fireEvent.click(button); fireEvent.click(button);
  expect(page.groupRequests()).toHaveLength(1);
  finish({ persisted: true, totalProgramCredits: 126 });
  await screen.findByText('25 / 126 tín chỉ');
});

it('does not refresh an already stored official total', async () => {
  const page = fixture({ total: 126 });
  await screen.findByText('25 / 126 tín chỉ');
  expect(page.requests.some(config => config.url === '/sync/iu/status')).toBe(false);
  expect(page.groupRequests()).toHaveLength(0);
});
