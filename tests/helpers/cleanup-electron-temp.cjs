"use strict";

// Chỉ xóa thư mục test đã tạo sau khi Electron đóng hết handle Chromium.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const directory = path.resolve(process.argv[2] || ".");
const parentPid = Number(process.argv[3]);
if (!directory.startsWith(path.resolve(os.tmpdir()) + path.sep)
    || !["unistudy-ai-e2e-", "unistudy-branches-e2e-"].some(prefix => path.basename(directory).startsWith(prefix))
    || !Number.isInteger(parentPid) || parentPid <= 0) process.exit(1);
const deadline = Date.now() + 30000;
const clean = () => {
    if (Date.now() > deadline) process.exit(1);
    try {
        process.kill(parentPid, 0);
    } catch (error) {
        if (error.code === "ESRCH") {
            try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); process.exit(0); }
            catch { /* Chromium có thể vừa mới giải phóng handle; thử lại. */ }
        }
    }
    setTimeout(clean, 100);
};
clean();
