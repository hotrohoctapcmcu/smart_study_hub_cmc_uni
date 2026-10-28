'use strict';

const http = require('node:http');
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const block = (prompt, label) => JSON.parse(prompt.split(label + '\n')[1].split('\n\n')[0]);

async function createProvider() {
    const state = { calls: [], status: 200, override: null, beforeReply: null };
    const provider = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/app') {
            res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': ['NID=sprint3-test; Path=/'] });
            return res.end('<script>window.WIZ_global_data={"cfb2h":"test-build","FdrFJe":"test-session"}</script>');
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const form = new URLSearchParams(body);
                const prompt = JSON.parse(JSON.parse(form.get('f.req'))[1])[0][0];
                state.calls.push(prompt);
                if (state.beforeReply) { const fn = state.beforeReply; state.beforeReply = null; await fn(); }
                let reply = 'Gia sư giải thích: JOIN kết hợp các dòng dựa trên điều kiện liên kết.';
                if (prompt.includes('Tạo đúng ')) {
                    const count = Number(prompt.match(/Tạo đúng (\d+)/)[1]);
                    const topic = prompt.match(/Chủ đề: (.*?)\. Độ khó:/)[1];
                    reply = JSON.stringify({ questions: Array.from({ length: count }, (_, i) => ({
                        question: `Câu ${i + 1}: JOIN có tác dụng gì? <img src=x onerror=window.__xss=1>`, topic,
                        options: ['Kết hợp các dòng', 'Xóa bảng', 'Đổi mật khẩu', 'Tắt máy'], correctIndex: 0,
                        explanation: 'JOIN kết hợp các dòng theo điều kiện. <script>window.__xss=1</script>'
                    })) });
                } else if (prompt.includes('Đề xuất nội dung ôn tập từ lịch sử làm bài')) {
                    const evidence = block(prompt, 'Kết quả đo từ bài kiểm tra:');
                    reply = JSON.stringify({ advice: evidence.topics.map(t => ({ key: t.key, recommendation: `Ôn ${t.topic}: đọc lại định nghĩa và so sánh ví dụ.`, exercise: 'Viết một câu truy vấn JOIN và tự giải thích kết quả.' })) });
                } else if (prompt.includes('Tạo bản xem trước các giai đoạn ôn thi')) {
                    const exams = block(prompt, 'Kỳ thi:');
                    const slots = block(prompt, 'Khoảng trống hợp lệ trong 31 ngày tới:');
                    const exam = exams[0];
                    const slot = slots.find(s => s.date > today() && s.date <= exam.date && s.start <= '18:00' && s.end >= '19:00');
                    reply = JSON.stringify({ phases: [{ examId: exam.id, title: 'Ôn JOIN <img src=x onerror=window.__xss=1>', target: 'Luyện JOIN theo điểm yếu', startDate: today(), endDate: exam.date, priority: 'HIGH' }],
                        sessions: slot ? [{ examId: exam.id, title: 'Luyện JOIN', subject: exam.subject, date: slot.date, start: '18:00', end: '19:00', reason: 'Ôn nội dung còn sai' }] : [] });
                } else if (prompt.includes('Soạn một đơn xin nghỉ học')) {
                    reply = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\n\nĐƠN XIN PHÉP NGHỈ HỌC\nKính gửi: [Điền thông tin]\nEm xin phép nghỉ theo ngày và lý do đã cung cấp.\nEm sẽ bổ sung bài học.\n<img src=x onerror=window.__xss=1>';
                }
                if (state.override !== null) reply = typeof state.override === 'function' ? state.override(prompt) : state.override;
                res.writeHead(state.status, { 'Content-Type': 'text/plain' });
                res.end(state.status === 200 ? JSON.stringify([['wrb.fr', null, JSON.stringify([null, ['cid', 'rid'], null, null, [['rcid', [reply]]]])]]) : 'provider rejected');
            } catch (error) { res.writeHead(500); res.end(error.message); }
        });
    });
    await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
    return { state, provider, origin: `http://127.0.0.1:${provider.address().port}` };
}

module.exports = { createProvider, today, addDays };
