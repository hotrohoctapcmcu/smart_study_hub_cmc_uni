'use strict';

const { loi: fail } = require('../utils/error');
const { nonempty } = require('../validators/learning.validator');
const parse = (value, fallback = []) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

function createLearningReview({ q, mutate, rowFor, courseView, cardView, db, clock, now }) {
    async function review(id, body) {
        if (!['again', 'hard', 'good', 'easy'].includes(body.rating) || !nonempty(body.requestId, 100)) throw fail('Mức ghi nhớ và mã lượt ôn không hợp lệ.');
        return mutate(async () => {
            const [saved] = await q('SELECT * FROM LearningReviews WHERE user_id=@uid AND request_id=@request', { request: body.requestId });
            if (saved) {
                if (saved.card_id !== id || saved.rating !== body.rating) throw fail('Mã lượt ôn đã được dùng cho lựa chọn khác.', 409);
                return parse(saved.result_json, {});
            }
            const [row] = await q('SELECT * FROM LearningCards WHERE user_id=@uid AND card_id=@id', { id });
            if (!row) throw fail('Không tìm thấy thẻ của bạn.', 404);
            const owner = await rowFor(row.course_id);
            const current = await courseView(owner);
            if (!owner.complete || owner.source_hash !== row.source_hash || !current.summary || current.summary.stale ||
                current.summary.summaryHash !== row.summary_hash) throw fail('Nội dung môn học đã thay đổi. Hãy cập nhật bộ thẻ trước khi ôn.', 409);
            const interval = body.rating === 'again' ? 1 / 1440 : body.rating === 'hard' ? Math.max(1, row.interval_days * 1.2) :
                body.rating === 'good' ? Math.max(1, row.interval_days * 2) : Math.max(4, row.interval_days * 3);
            const due = new Date(new Date(clock()).getTime() + Math.min(365, interval) * 86400000).toISOString();
            const updated = { ...row, due_at: due, interval_days: Math.min(365, interval), review_count: row.review_count + 1 };
            const view = cardView(updated);
            await db().withTransaction(async () => {
                await q('UPDATE LearningCards SET due_at=@due,interval_days=@interval,review_count=@reviews WHERE user_id=@uid AND card_id=@id', { id, due, interval: updated.interval_days, reviews: updated.review_count });
                await q('INSERT INTO LearningReviews(user_id,request_id,card_id,rating,result_json,created_at) VALUES(@uid,@request,@id,@rating,@result,@created)',
                    { request: body.requestId, id, rating: body.rating, result: JSON.stringify(view), created: now() });
            });
            return view;
        });
    }

    return review;
}

module.exports = { createLearningReview };
