"use strict";

/**
 * endpoints.js — Bang tra cuu endpoint ma hoa cua portal IU.
 *
 * NHIEM VU:
 * Doc endpoint_map.txt thanh object tra cuu:
 * { TenHamThat: { module, suffix, func } }.
 * Chi doc va tra cuu, khong dung payload, khong ma hoa.
 *
 * NGUON DU LIEU:
 * - payload/endpoint_map.txt: endpoint trich tu source portal trong portalSrc,
 *   gom cac module, thu muc script, tep JavaScript, Core va Index.aspx.
 *   Suffix duoc giai bang key "A", sau do doi chieu voi field func that
 *   (pkg_*.TenHam) di kem moi request.
 * - Bang du phong gom 3 endpoint diem khi khong co file txt hop le.
 *
 * CACH DUNG:
 *   const { traEndpoint, lietKeEndpoint } = require("./endpoints");
 *   traEndpoint("KetQuaHocTapCaNhan");
 */

const fs = require("fs");
const path = require("path");

let ENDPOINTS = null;

function docBangEndpoint() {
    if (ENDPOINTS) return ENDPOINTS;

    ENDPOINTS = {};

    try {
        const duongDan = path.join(__dirname, "endpoint_map.txt");
        const txt = fs.readFileSync(duongDan, "utf8");

        let modHienTai = "";

        for (const line of txt.split(/\r?\n/)) {
            const mMod = /^\s*MODULE:\s*(\S+)/.exec(line);

            if (mMod) {
                modHienTai = mMod[1];
                continue;
            }

            const m =
                /^\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9+/=]+)(?:\s+#\s+(\S+))?/.exec(line);

            if (m && modHienTai) {
                ENDPOINTS[m[1]] = {
                    module: modHienTai,
                    suffix: m[2],
                    func: m[3] || "",
                };
            }
        }
    } catch {
        // Khong co file endpoint_map.txt hoac khong doc duoc file.
    }

    if (Object.keys(ENDPOINTS).length === 0) {
        ENDPOINTS = {
            KetQuaHocTapCaNhan: {
                module: "SV_ThongTin_MH",
                suffix: "CiQ1EDQgCS4iFSAxAiAPKSAv",
                func: "pkg_congthongtin_hssv_thongtin.KetQuaHocTapCaNhan",
            },

            LayKetQuaTichLuyTheoKhoi: {
                module: "SV_ThongTin_MH",
                suffix: "DSA4CiQ1EDQgFSgiKQ00OBUpJC4KKS4o",
                func: "pkg_congthongtin_hssv_thongtin.LayKetQuaTichLuyTheoKhoi",
            },

            LayDSThoiGianLichHoc: {
                module: "SV_ThongTin_MH",
                suffix: "DSA4BRIVKS4oBiggLw0oIikJLiIP",
                func: "pkg_congthongtin_hssv_thongtin.LayDSThoiGianLichHoc",
            },
        };
    }

    return ENDPOINTS;
}

/**
 * Tra cuu endpoint theo ten ham that.
 * Nem loi neu endpoint khong ton tai.
 */
function traEndpoint(tenEndpoint) {
    if (typeof tenEndpoint !== "string" || !tenEndpoint.trim()) {
        throw new TypeError("Ten endpoint phai la chuoi khong rong.");
    }

    const bang = docBangEndpoint();
    const endpoint = bang[tenEndpoint];

    if (!endpoint) {
        throw new Error(
            `Khong tim thay endpoint "${tenEndpoint}". ` +
            "Hay kiem tra ten endpoint trong payload/endpoint_map.txt."
        );
    }

    return endpoint;
}

/**
 * Liet ke ten tat ca endpoint theo thu tu alphabet.
 */
function lietKeEndpoint() {
    return Object.keys(docBangEndpoint()).sort();
}

module.exports = {
    traEndpoint,
    lietKeEndpoint,
};