const sinhVien = require('./sinhVien');
const thoiKhoaBieu = require('./thoiKhoaBieu');
const baiTap = require('./baiTap');
const nhacNho = require('./nhacNho');
const kyThi = require('./kyThi');
const dongBo = require('./dongBo');
const troLyAI = require('./troLyAI');
const timemap = require('./timemap');
const progress = require('./progress');
const workspace = require('./workspace');

const MODULES = [
    { name: 'student', paths: ['/student'], router: sinhVien },
    { name: 'schedules', paths: ['/schedules'], router: thoiKhoaBieu },
    { name: 'tasks', paths: ['/tasks', '/checklist'], router: baiTap },
    { name: 'notifications', paths: ['/notifications'], router: nhacNho },
    { name: 'exams', paths: ['/exams'], router: kyThi },
    { name: 'sync', paths: ['/sync'], router: dongBo },
    { name: 'ai', paths: ['/ai'], router: troLyAI },
    { name: 'timemap', paths: ['/timemap'], router: timemap },
    { name: 'progress', paths: ['/progress'], router: progress },
    { name: 'workspace', paths: ['/'], router: workspace }
];

function setDbForAll(db) { 
    MODULES.forEach(({ router }) => router.setDb?.(db));
}

function registerModules(app, apiPrefix) {
    MODULES.forEach(({ paths, router }) => {
        paths.forEach(path => app.use(`${apiPrefix}${path}`, router));
    });
}

module.exports = { MODULES, setDbForAll, registerModules };
