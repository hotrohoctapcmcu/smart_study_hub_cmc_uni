"use strict";

/**
 * keys.js — Bo key ma hoa/giai ma cua portal IU.
 *
 * NHIEM VU: giu 4 key dung de ma hoa request / giai ma response.
 *
 * NGUON DU LIEU (source that trong portalSrc/):
 *  - "A" (0x41): key XOR ten ham trong URL.
 *    Chuan: function AE/AD cuoi file
 *      portalSrc/loi/assets_js_crypto-js.js
 *    Kiem chung: AD("DSA4CiQ1EDQgFSgiKQ00OBUpJC4KKS4o", "A")
 *      -> "LayKetQuaTichLuyTheoKhoi" (khop field func that trong source).
 *  - "AzzSystem": key giai Data.B trong response = gia tri mac dinh cua
 *    edu.system.iM.
 *    Chuan: ham AFG() trong file
 *      portalSrc/loi/pagination.js
 *    co dong `t.iM = "AzzSystem"`.
 *  - "AzzS": key giai chuoi cau hinh AXYZCLRVN() nhung trong
 *    portalSrc/loi/Index.aspx :
 *      o = JSON.parse(AD(e, "AzzS"))
 *  - "31415926535": key ma hoa session trinh duyet
 *    (sessionStorage "objUserN", ham AS()/AFG trong pagination.js).
 *
 * THU TU UU TIEN khi giai Data.B: "AzzSystem" truoc (key dung nhat cho
 * response), sau do thu cac key con lai cho loai payload khac.
 */

const APIS_KEYS = ["AzzSystem", "A", "AzzS", "31415926535"];

// Key mac dinh cua phien (edu.system.iM) — dung de giai Data.B.
const IM_MAC_DINH = "AzzSystem";

module.exports = { APIS_KEYS, IM_MAC_DINH };
