import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProvider } from '../components/common/ui';
import Profile from '../pages/Profile/Profile';
import apiClient from '../api/apiClient';
import { buildCourseRows, buildStudyStats } from '../components/profile/profileData';
import { mapGrades, mapStudent } from '../utils/studentAdapter';
import transcript from '../../../tests/fixtures/iu-grade-transcript.cjs';
import curriculum from '../../../tests/fixtures/iu-curriculum.cjs';

const adapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = adapter; localStorage.clear(); });
const academicSummary = {
  overall: { average10: 5.95, average4: 2.25, cumulative10: 6.66, cumulative4: 2.52, earnedCredits: 25, subjectCount: 13, completedSubjects: 13, passedSubjects: 12 },
  comparison: { average10Delta: 1.86 },
  semesters: [
    { key: '2025-2026|2', semester: '2', academicYear: '2025-2026', average10: 4.96, average4: 0.81, gradedCredits: 8, passedSubjects: 2, failedSubjects: 1 },
    { key: '2025-2026|3', semester: '3', academicYear: '2025-2026', average10: 6.82, average4: 2.23, gradedCredits: 20, passedSubjects: 5, failedSubjects: 1 },
  ],
};
describe('Profile GPA matches IU scopes', () => {
  it('uses shared backend totals instead of averaging failed/passed/retake rows again', () => {
    expect(mapStudent({ student_code: 'BSE250047', enrollment_year: 2023, cohort: 'Khóa 2023' }).cohort).toBe('Khóa 2025');
    expect(mapStudent({ studentCode: 'bse250047' }).cohort).toBe('Khóa 2025');
    expect(mapStudent({ student_code: 'BIT240001' }).cohort).toBe('Khóa 2024');
    expect(mapStudent({ student_code: 'LEGACY', enrollment_year: 2022 }).cohort).toBe('Khóa 2022');
    expect(mapStudent({ student_code: 'GPA-TEST' }).cohort).toBe('');
    const student = mapStudent({ academic_summary: academicSummary, total_passed_credits: 25 });
    const stats = buildStudyStats(mapGrades(transcript), [], student);
    expect(stats.gpaText).toBe('6.66'); expect(stats.gpa4Text).toBe('2.52');
    expect(stats.gpaDelta).toBe(1.86); expect(stats.completedCredits).toBe(25);
    expect(stats.totalCredits).toBeNull();
    const official = buildStudyStats([], [], mapStudent({ academic_summary: academicSummary, total_program_credits: 126 }), 150);
    expect(official.completedCredits).toBe(25); expect(official.totalCredits).toBe(126);
    expect(official.creditScope).toBe('chương trình');
    expect(buildStudyStats([], [], { totalCredits: 0 }, -1).totalCredits).toBeNull();
    const math = buildCourseRows([], mapGrades(transcript)).find(row => row.code === 'MATH');
    expect(math.score).toBe(5.2);
  });
  it('shows all four IU indicators and preserves overall totals while filtering a semester', async () => {
    apiClient.defaults.adapter = async config => {
      const response = data => ({ config, status: 200, headers: {}, data: { success: true, data } });
      if (config.url === '/student/profile') return response({ student_code: 'BSE250001', enrollment_year: 2023, cohort: 'Khóa 2023', full_name: 'Academic tester', academic_summary: academicSummary, total_passed_credits: 25 });
      if (config.url === '/student/grades') return response(config.params?.hocKy ? transcript.filter(row => row.semester === config.params.hocKy) : transcript);
      if (config.url === '/student/subjects') return response([]);
      return adapter(config);
    };
    render(<MemoryRouter><AppProvider><Profile /></AppProvider></MemoryRouter>);
    const recap = await screen.findByRole('region', { name: 'Đối chiếu điểm IU' });
    for (const score of ['5.95', '2.25', '6.66', '2.52']) expect(within(recap).getByText(score, { exact: false })).toBeTruthy();
    expect(await screen.findByText('2.52 / 4')).toBeTruthy();
    expect(screen.getByText('Khóa 2025')).toBeTruthy();
    expect(screen.queryByText('Khóa 2023')).toBeNull();
    const creditCard = screen.getByText('Tín chỉ tích lũy').closest('article');
    expect(within(creditCard).getByText('25 tín chỉ')).toBeTruthy();
    expect(creditCard.textContent).not.toContain('/ —');
    expect(creditCard.querySelector('.profile-stat-progress')).toBeNull();
    expect(document.querySelector('.progress-card .study-donut')).toBeNull();
    fireEvent.click(within(creditCard).getByRole('button', { name: 'Cập nhật tổng tín chỉ' }));
    const goalDialog = screen.getByRole('dialog', { name: 'Mục tiêu học tập' });
    fireEvent.change(within(goalDialog).getByLabelText('Tổng tín chỉ chương trình (tùy chọn)'), { target: { value: '126' } });
    fireEvent.click(within(goalDialog).getByRole('button', { name: 'Lưu mục tiêu' }));
    await waitFor(() => expect(within(creditCard).getByText('25 / 126 tín chỉ')).toBeTruthy());
    expect(within(creditCard).getByText('20% chương trình (tự nhập)')).toBeTruthy();
    expect(document.querySelector('.study-credit-list').textContent).toContain('101');
    expect(JSON.parse(localStorage.getItem('ssh-profile:BSE250001')).totalCredits).toBe(126);
    await screen.findByRole('option', { name: '2_2025_2026' });
    fireEvent.change(screen.getByLabelText('Lọc học kỳ'), { target: { value: '2_2025_2026' } });
    await waitFor(() => expect(screen.queryByText('Subject DB')).toBeNull());
    expect(screen.getByText('2.52 / 4')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Bộ lọc điểm'), { target: { value: 'passed' } });
    expect(screen.getByText('Subject HISTORY')).toBeTruthy();
    expect(screen.getByText('Subject PASS1')).toBeTruthy();
  });
  it('shows the IU program total automatically and finds ungraded subjects by code, status and knowledge block', async () => {
    localStorage.setItem('ssh-profile:BSE250001', JSON.stringify({ totalCredits: 150 }));
    let synced = false;
    apiClient.defaults.adapter = async config => {
      const response = data => ({ config, status: 200, headers: {}, data: { success: true, data } });
      if (config.url === '/student/profile') return response({ student_code: 'BSE250001', full_name: 'Curriculum tester',
        program_name: synced ? curriculum.programs[0].TEN : null, total_program_credits: synced ? 126 : null,
        required_program_credits: synced ? 129 : null, available_block_credits: synced ? 203 : null,
        block_earned_credits: synced ? 28 : null, total_passed_credits: 25, academic_summary: academicSummary });
      if (config.url === '/student/grades') return response([]);
      if (config.url === '/student/subjects') return response(!synced ? [] : curriculum.accumulated.rsChiTiet.map((row, i) => ({
        subject_id: i + 1, subject_code: row.DAOTAO_HOCPHAN_MA, subject_name: row.DAOTAO_HOCPHAN_TEN,
        credits: row.DAOTAO_HOCPHAN_HOCTRINH, block_name: row.TENKHOI, status: 'PLANNED',
      })));
      return adapter(config);
    };
    render(<MemoryRouter><AppProvider><Profile /></AppProvider></MemoryRouter>);
    await screen.findByText('25 / 150 tín chỉ');
    synced = true;
    fireEvent(window, new Event('workspace-updated'));
    const credit = await screen.findByText('25 / 126 tín chỉ');
    expect(within(credit.closest('article')).getByText('20% chương trình')).toBeTruthy();
    expect(screen.queryByText('25 / 150 tín chỉ')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa mục tiêu' }));
    const officialInput = within(screen.getByRole('dialog')).getByLabelText('Tổng tín chỉ chương trình từ IU');
    expect(officialInput.value).toBe('126'); expect(officialInput.readOnly).toBe(true);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Đóng/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Môn học' }));
    expect(await screen.findByRole('heading', { name: 'Toàn bộ học phần' })).toBeTruthy();
    expect(screen.getByText(/Cử nhân Kỹ thuật phần mềm_K4/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('5 / 5 học phần');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm học phần' }), { target: { value: 'SENG' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Khối kiến thức' }), { target: { value: 'Chuyên ngành' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Trạng thái học phần' }), { target: { value: 'Chưa bắt đầu' } });
    expect(screen.getByRole('status').textContent).toContain('2 / 5 học phần');
    const card = screen.getByRole('heading', { name: 'Phát triển ứng dụng web nâng cao' }).closest('article');
    expect(card.textContent).toContain('Chưa bắt đầu');
    expect(card.querySelector('.grade-score').textContent).toBe('—');
    fireEvent.click(within(card).getByRole('button', { name: /Xem môn học/ }));
    const dialog = screen.getByRole('dialog', { name: 'Phát triển ứng dụng web nâng cao' });
    expect(dialog.textContent).toContain('SENG3009'); expect(dialog.textContent).toContain('Chuyên ngành');
    fireEvent.click(within(dialog).getByRole('button', { name: /Đóng/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'không tồn tại' } });
    expect(screen.getByText('Không tìm thấy học phần phù hợp')).toBeTruthy();
  });
});
