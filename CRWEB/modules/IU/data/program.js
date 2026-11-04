"use strict";

const text = value => value == null ? '' : String(value).trim();
const key = value => text(value).replace(/[^a-z0-9]/gi, '').toUpperCase();
function number(value) {
    if (value == null || text(value) === '' || typeof value === 'boolean') return null;
    const result = Number(text(value).replace(',', '.'));
    return Number.isFinite(result) && result >= 0 ? result : null;
}
function field(row, names) {
    const fields = new Map(Object.entries(row || {}).map(([name, value]) => [key(name), value]));
    for (const name of names) {
        const value = fields.get(key(name));
        if (value != null && text(value) !== '') return value;
    }
    return null;
}
function programId(row) {
    return text(row?.DAOTAO_TOCHUCCHUONGTRINH_ID || row?.ID || row?.DAOTAO_CHUONGTRINH_ID);
}

// Only explicit program totals are accepted. Course credits, earned credits,
// required block credits and sums of rsTongHop/rsChiTiet are never denominators.
// Portal installations can spell these fields differently; keep the field path
// as provenance so a live response can be checked without retaining raw profiles.
const explicitTotals = new Set([
    'TONGTINCHICHUONGTRINH', 'TONGSOTINCHICHUONGTRINH', 'TONGSOHOCTRINHCHUONGTRINH',
    'CHUONGTRINHTONGTINCHI', 'CHUONGTRINHTONGSOHOCTRINH', 'TOTALPROGRAMCREDITS',
    'DAOTAOCHUONGTRINHHOCTRINH', 'DAOTAOCHUONGTRINHTONGSOHOCTRINH',
    'DAOTAOCHUONGTRINHTONGSOTINCHI', 'DAOTAOTOCHUCCHUONGTRINHHOCTRINH',
    'DAOTAOTOCHUCCHUONGTRINHTONGSOHOCTRINH', 'DAOTAOTOCHUCCHUONGTRINHTONGSOTINCHI',
    'DAOTAOCHUONGTRINHSOHOCTRINH', 'DAOTAOCHUONGTRINHSOTINCHI',
    'DAOTAOTOCHUCCHUONGTRINHSOHOCTRINH', 'DAOTAOTOCHUCCHUONGTRINHSOTINCHI',
    'SOHOCTRINHCHUONGTRINH', 'SOTINCHICHUONGTRINH',
]);
const summaryTotals = new Set(['TONGSOHOCTRINH', 'TONGHOCTRINH', 'TONGSOTINCHI', 'TONGTINCHI']);

function mapThongTinChuongTrinh(programs, results, accumulated, selectedId) {
    const rows = Array.isArray(programs) ? programs : [];
    const selected = selectedId ? rows.find(row => programId(row) === text(selectedId)) : rows[0];
    const id = text(selectedId) || programId(selected);
    if (!id) return null;
    const candidates = [];
    function scan(value, path, depth = 0, genericTotal = false) {
        if (!value || typeof value !== 'object' || depth > 4) return;
        if (Array.isArray(value)) {
            // A summary is a singleton recordset. Never aggregate list rows.
            if (value.length === 1) scan(value[0], `${path}[0]`, depth + 1, genericTotal);
            return;
        }
        if (Object.keys(value).some(name => /DAOTAOHOCPHAN|TENKHOI|MAKHOI|KHOIKIENTHUC/.test(key(name)))) return;
        for (const [name, item] of Object.entries(value)) {
            const normalized = key(name);
            if (explicitTotals.has(normalized) || genericTotal && summaryTotals.has(normalized)
                || path === 'LayThongTinChuongTrinhHoc.selected' && ['SOHOCTRINH', 'SOTINCHI', 'HOCTRINH'].includes(normalized)) {
                const credits = number(item);
                if (credits > 0) candidates.push({ credits, path: `${path}.${name}`, rank: explicitTotals.has(normalized) ? 2 : 1 });
            }
            if (item && typeof item === 'object' && !/CHITIET|TONGHOP|HOCPHAN|DIEMTHANHPHAN|KHOI/.test(normalized)) {
                scan(item, `${path}.${name}`, depth + 1,
                    path === 'KetQuaHocTapCaNhan' && ['RSTHONGTINNGUOIHOC', 'RSTHONGTINCHUONGTRINH'].includes(normalized));
            }
        }
    }
    scan(selected, 'LayThongTinChuongTrinhHoc.selected', 0, true);
    scan(results, 'KetQuaHocTapCaNhan', 0, true);
    scan(accumulated, 'LayKetQuaTichLuyTheoKhoi');
    const rank = Math.max(0, ...candidates.map(item => item.rank));
    const best = candidates.filter(item => item.rank === rank);
    let total = new Set(best.map(item => item.credits)).size === 1 ? best[0] : null;
    // diemhoc.js / genHtml_TongDiem selects this overall record, not the
    // student identity record or a semester/cumulative credit total.
    const averages = Array.isArray(results?.rsDiemTrungBinhChung) ? results.rsDiemTrungBinhChung : [];
    const overallIndex = averages.findIndex(row => row.DAOTAO_THOIGIANDAOTAO_ID === null
        && row.LOAIDIEMTRUNGBINH_MA === 'TRUNGBINHCHUNG'
        && number(row.THUOCTINHLANTINH) === 0 && text(row.THANGDIEM_MA) === '10');
    const officialCredits = number(averages[overallIndex]?.TONGSOTINCHICTDT);
    if (officialCredits > 0) total = { credits: officialCredits,
        path: `KetQuaHocTapCaNhan.rsDiemTrungBinhChung[${overallIndex}].TONGSOTINCHICTDT` };
    return {
        ma: id,
        ten: text(field(selected, ['DAOTAO_CHUONGTRINH_TEN', 'DAOTAO_TOCHUCCHUONGTRINH_TEN', 'TEN'])),
        tong_tin_chi: total?.credits ?? null,
        nguon_tong_tin_chi: total?.path ?? null,
    };
}

function mapKhoiKienThuc(rows) {
    const blockNumber = (row, names, emptyAsZero = false) => {
        const value = field(row, names);
        // IU leaves zero earned/required cells blank; its table footer sums
        // these as zero. A wholly absent column still means unknown data.
        return value == null && emptyAsZero && Object.keys(row).some(name => names.map(key).includes(key(name))) ? 0 : number(value);
    };
    return (Array.isArray(rows) ? rows : []).map(row => ({
        ma: text(field(row, ['MAKHOI', 'DAOTAO_KHOIKIENTHUC_MA', 'MA'])),
        ten: text(field(row, ['TENKHOI', 'DAOTAO_KHOIKIENTHUC_TEN', 'TEN'])),
        tong_tin_chi: number(field(row, ['TONGSOTINCHICUAKHOI', 'TONGSOHOCTRINH', 'TONGSOTINCHI', 'TONGTINCHI', 'SOHOCTRINH'])),
        tin_chi_bat_buoc: blockNumber(row, ['SOBATBUOC', 'SOHOCTRINHBATBUOC', 'SOTINCHIBATBUOC', 'BATBUOC'], true),
        tin_chi_dat: blockNumber(row, ['SODATICHLUY', 'SOHOCTRINHDAT', 'SOTINCHIDAT', 'TINCHITICHLUY'], true),
    }));
}

module.exports = { mapThongTinChuongTrinh, mapKhoiKienThuc };
