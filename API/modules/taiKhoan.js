const express = require('express');
const bcrypt = require('bcryptjs');
const { taoToken } = require('../shared/auth');

const router = express.Router();
let db;

const loi = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode });

function setDb(instance) {
    db = instance;
}

async function xuLyDangNhap(username, password) {
    if (!username || !password) {
        throw loi('username và password là bắt buộc.');
    }

    const taoNguoiDung = (id, username, fullName, email, role) => {
        const user = { id, username, fullName, email, role };
        return { token: taoToken(user, '7d'), user };
    };

    if (db?.isMockMode) {
        if (
            ['CMC123456', 'sinhvien'].includes(username) &&
            ['123456', '12345678'].includes(password)
        ) {
            return taoNguoiDung(
                1,
                'CMC123456',
                'Nguyễn Văn An',
                'an.nv@student.cmcu.edu.vn',
                'student'
            );
        }

        if (username === 'admin' && password === 'admin123') {
            return taoNguoiDung(
                99,
                'admin',
                'Quản trị viên UniStudy',
                'admin@cmcu.edu.vn',
                'admin'
            );
        }
    }

    const rows = await db.executeQuery(
        `SELECT user_id, username, password_hash, full_name, email, role, is_active
         FROM Users
         WHERE username = @username`,
        { username }
    );

    if (!rows.length) {
        throw loi('Tài khoản không tồn tại.', 401);
    }

    const user = rows[0];

    if (!user.is_active) {
        throw loi('Tài khoản đã bị khóa.', 403);
    }

    if (!await bcrypt.compare(password, user.password_hash)) {
        throw loi('Sai mật khẩu.', 401);
    }

    return taoNguoiDung(
        user.user_id,
        user.username,
        user.full_name,
        user.email,
        user.role
    );
}

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        res.json({ success: true, ...await xuLyDangNhap(username, password) });
    } catch (err) {
        next(err);
    }
});

router.post('/sync', async (req, res, next) => {
    try {
        const { userId, dataIU } = req.body || {};

        if (!userId || !dataIU) {
            throw loi('userId và dataIU là bắt buộc.');
        }

        const data = await db.dongBoHoSoIU(userId, dataIU);

        res.json({
            success: true,
            message: 'Đồng bộ dữ liệu IU thành công.',
            data
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
module.exports.setDb = setDb; 