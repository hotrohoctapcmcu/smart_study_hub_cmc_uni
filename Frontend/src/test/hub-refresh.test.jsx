import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import MobileNavigation from '../components/layout/MobileNavigation';
import Topbar from '../components/layout/Topbar';
import AppLayout from '../components/layout/AppLayout';
import { weeklyActivity } from '../utils/progressAdapter';
import { weekDays } from '../utils/date';
import { ScheduleItem } from '../components/dashboard/Widgets';

describe('Complete hub navigation', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => { window.matchMedia = originalMatchMedia; });
  it('exposes the independent textbook and activates only the selected learning subpage', () => {
    render(<MemoryRouter initialEntries={['/learning?tab=pomodoro']}><Sidebar /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Vở ghi' }).getAttribute('href')).toBe('/textbook');
    const learningToggle = within(nav).getByRole('button', { name: 'Học tập' });
    const documentsToggle = within(nav).getByRole('button', { name: 'Tài liệu' });
    expect(learningToggle.getAttribute('aria-expanded')).toBe('false');
    expect(documentsToggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(nav).queryByRole('link', { name: 'Pomodoro' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Ghi chú' })).toBeNull();
    fireEvent.click(learningToggle);
    expect(within(nav).getByRole('link', { name: 'Pomodoro' }).classList.contains('active')).toBe(true);
    expect(within(nav).getByRole('link', { name: 'Flashcard' }).classList.contains('active')).toBe(false);
    expect(within(nav).getByRole('link', { name: 'Flashcard' }).hasAttribute('aria-current')).toBe(false);
    fireEvent.click(documentsToggle);
    expect(within(nav).getByRole('link', { name: 'Ghi chú' }).getAttribute('href')).toBe('/documents?tab=notes');
    expect(within(nav).getByRole('link', { name: 'Hồ sơ' }).getAttribute('href')).toBe('/profile');
    fireEvent.click(learningToggle);
    fireEvent.click(documentsToggle);
    expect(within(nav).queryByRole('link', { name: 'Flashcard' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Ghi chú' })).toBeNull();
  });
  it('closes the tablet drawer when a subpage changes on the same route', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render(<MemoryRouter initialEntries={['/learning?tab=subjects']}><AppLayout /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    const sidebar = document.getElementById('main-sidebar');
    expect(sidebar.getAttribute('role')).toBe('dialog');
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Học tập' }));
    expect(sidebar.hasAttribute('inert')).toBe(false);
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Flashcard' }));
    await waitFor(() => expect(sidebar.hasAttribute('inert')).toBe(true));
    expect(screen.getByRole('button', { name: 'Mở menu' }).getAttribute('aria-expanded')).toBe('false');
  });
  it('places the textbook directly on mobile navigation', () => {
    render(<MemoryRouter><MobileNavigation /></MemoryRouter>);
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Vở ghi' }).getAttribute('href')).toBe('/textbook');
  });
  it('opens a dismissible profile menu with profile and settings destinations', async () => {
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0));
    const trigger = screen.getByRole('button', { name: 'Tài khoản sinh viên' });
    fireEvent.click(trigger);
    const menu = document.getElementById('profile-dropdown');
    expect(within(menu).getByRole('link', { name: 'Hồ sơ sinh viên' }).getAttribute('href')).toBe('/profile');
    expect(within(menu).getByRole('link', { name: 'Cài đặt' }).getAttribute('href')).toBe('/settings');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('profile-dropdown')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Weekly activity from API records', () => {
  it('aligns dated and weekday study hours and counts completions on their recorded day', () => {
    const days = weekDays(new Date('2026-10-29T12:00:00'));
    const rows = weeklyActivity(days, [{ date: '2026-10-26', value: 2.5 }, { name: 'T5', value: 4 }, { name: 'Chủ nhật', value: 1 }], [
      { status: 'COMPLETED', completed_at: '2026-10-29T10:00:00', deadline: '2026-10-27' },
      { status: 'PENDING', deadline: '2026-10-29' },
      { status: 'COMPLETED', completed_at: '2026-10-19T10:00:00' },
    ]);
    expect(rows).toHaveLength(7);
    expect(rows[0].value).toBe(2.5);
    expect(rows[3]).toMatchObject({ name: 'T5', date: '2026-10-29', value: 4, completed: 1 });
    expect(rows[1].completed).toBe(0);
    expect(rows[6]).toMatchObject({ name: 'CN', value: 1 });
  });
  it('shows an accurate timing badge on today schedule entries', () => {
    const item = { subject_name: 'Giải tích', study_date: '2026-10-29', start_time: '08:00', end_time: '09:30' };
    const { rerender } = render(<ScheduleItem item={item} showTiming now={new Date('2026-10-29T07:00:00')} />);
    expect(screen.getByText('Sắp diễn ra')).toBeTruthy();
    rerender(<ScheduleItem item={item} showTiming now={new Date('2026-10-29T08:30:00')} />);
    expect(screen.getByText('Đang diễn ra')).toBeTruthy();
    rerender(<ScheduleItem item={item} showTiming now={new Date('2026-10-29T10:00:00')} />);
    expect(screen.getByText('Đã kết thúc')).toBeTruthy();
  });
});
