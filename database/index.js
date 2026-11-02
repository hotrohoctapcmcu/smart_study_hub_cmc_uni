'use strict';

const {
    getPool, closePool, sql, executeQuery, executeProcedure, withTransaction
} = require('./connection/db');

const academic = {
    ...require('./modules/profile'),
    ...require('./modules/schedule'),
    ...require('./modules/task'),
    ...require('./modules/reminder'),
    ...require('./modules/exam'),
    ...require('./modules/eduxAssignment')
};
const study = {
    ...require('./modules/study'),
    ...require('./modules/pomodoro'),
    ...require('./modules/notebook'),
    ...require('./modules/progress'),
    ...require('./modules/eduxDocument')
};
const integrity = require('./shared/integrity');

async function ketNoiDatabase() {
    await getPool();
    console.log('[DB] Đã khởi tạo cơ sở dữ liệu SQLite thành công (Chế độ LIVE DB).');
    return {
        ...study,
        ...integrity,
        sql, getPool, closePool, executeQuery, executeProcedure, withTransaction,
        ...academic
    };
}

Object.assign(ketNoiDatabase, academic, study, integrity);
ketNoiDatabase.ketNoiDatabase = ketNoiDatabase;
ketNoiDatabase.closePool = closePool;

module.exports = ketNoiDatabase;
