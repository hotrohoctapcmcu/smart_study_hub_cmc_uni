'use strict';

// Extract only dates/times present in the message. Conflicting or incomplete
// announcements remain unprocessed for the user to inspect in Outlook.
function analyzeMessage(mail) {
    const content = String(mail.body || mail.preview || '');
    const heading = String(mail.subject || '');
    const full = heading + '\n' + content;
    const result = { extractedDeadline: null, extractedExam: null, analysisSource: 'Nội dung email', analysisWarning: '' };
    const deadlinePattern = /hạn\s*(?:chót|nộp|cuối)|deadline|nộp[^\n]{0,80}trước/gi;
    const examPattern = /ngày thi|lịch thi/gi;

    function moment(section, kind) {
        const dates = new Set();
        for (const match of section.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/g)) {
            const [, day, month, year] = match.map(Number);
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) dates.add(date);
        }
        if (dates.size !== 1) return null;
        const labelledTime = kind === 'exam' ? /(?:giờ thi|ca thi|bắt đầu)\s*:?\s*(\d{1,2})[:h](\d{2})/i.exec(section) : null;
        const times = new Set();
        for (const match of labelledTime ? [labelledTime] : section.matchAll(/\b(\d{1,2})[:h](\d{2})\b/gi)) {
            if (Number(match[1]) <= 23 && Number(match[2]) <= 59) times.add(`${match[1].padStart(2, '0')}:${match[2]}`);
        }
        return times.size === 1 ? { date: [...dates][0], time: [...times][0] } : null;
    }
    function findMoment(pattern, kind) {
        const anchors = [...content.matchAll(pattern)];
        const candidates = new Map();
        for (const anchor of anchors) {
            const section = content.slice(anchor.index, anchor.index + 450).split(/\n\s*\n/)[0];
            const when = moment(section, kind);
            if (when) candidates.set(`${when.date}T${when.time}`, when);
        }
        if (!anchors.length && new RegExp(pattern.source, 'i').test(heading)) {
            const when = moment(content.slice(0, 600), kind);
            if (when) candidates.set(`${when.date}T${when.time}`, when);
        }
        return candidates.size === 1 ? [...candidates.values()][0] : null;
    }
    const code = /\b([A-Z]{2,8}\d{2,5})\b/.exec(full)?.[1] || '';
    const subject = /(?:Học phần|Môn học|Môn)\s*:\s*([^\n(]+)/i.exec(content)?.[1]?.trim() || code || heading;
    if (new RegExp(deadlinePattern.source, 'i').test(full)) {
        const when = findMoment(deadlinePattern, 'deadline');
        if (when) result.extractedDeadline = { title: heading, subject, due: `${when.date}T${when.time}`, priority: 'Cao' };
        else result.analysisWarning = 'Có nhắc hạn nộp nhưng ngày/giờ thiếu hoặc mâu thuẫn; hãy kiểm tra thư gốc.';
    }
    if (new RegExp(examPattern.source, 'i').test(full)) {
        const when = findMoment(examPattern, 'exam');
        if (when) result.extractedExam = { subject, code, date: when.date, start: when.time,
            duration: Number(/(?:thời lượng|thời gian làm bài)\s*:\s*(\d+)/i.exec(content)?.[1]) || 90,
            room: /phòng thi\s*:\s*([^\n(]+)/i.exec(content)?.[1]?.trim() || /phòng\s*:?\s*([A-Za-z]*\d[\w.-]*)/i.exec(content)?.[1] || 'Chưa rõ', scope: '' };
        else result.analysisWarning = 'Có thông báo thi nhưng ngày/giờ thiếu hoặc mâu thuẫn; hãy kiểm tra thư gốc.';
    }
    return result;
}

module.exports = { analyzeMessage };
