import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { User, Bell, Palette, Shield, RefreshCw, Globe } from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Badge,
} from "../../components/common/ui";
import {
  readPreferences,
  applyPreferences,
  defaultPreferences,
} from "../../utils/preferences";
const items = [
  ["profile", "Hồ sơ", User],
  ["notifications", "Thông báo", Bell],
  ["appearance", "Giao diện", Palette],
  ["account", "Tài khoản", Shield],
  ["sync", "Đồng bộ", RefreshCw],
  ["language", "Ngôn ngữ", Globe],
];
export default function Settings() {
  const [active, setActive] = useState("appearance"),
    [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);
  const update = (key, value) =>
    setPreferences((p) => ({ ...p, [key]: value }));
  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="CÁ NHÂN HÓA TRẢI NGHIỆM"
        title="Cài đặt"
        description="Một không gian học tập mang phong cách của bạn."
      />
      <div className="settings-layout">
        <nav data-region="B" className="card settings-nav" aria-label="Danh mục cài đặt">
          {items.map(([key, name, Icon]) => (
            <button
              key={key}
              className={active === key ? "active" : ""}
              onClick={() => setActive(key)}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
        <Card region="C" title={items.find((x) => x[0] === active)[1]}>
          {active === "appearance" ? (
            <div className="settings-section">
              <div>
                <h3>Chế độ hiển thị</h3>
                <div className="theme-options">
                  {[
                    ["light", "Sáng"],
                    ["dark", "Tối"],
                    ["system", "Hệ thống"],
                  ].map(([key, label]) => (
                    <button
                      className={
                        "theme-option " +
                        (preferences.theme === key ? "active" : "")
                      }
                      key={key}
                      onClick={() => update("theme", key)}
                      aria-pressed={preferences.theme === key}
                    >
                      <div className={"theme-preview " + key}>
                        <i />
                        <div>
                          <b />
                          <b />
                          <b />
                        </div>
                      </div>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>Màu chủ đạo</h3>
                <div className="actions" style={{ gap: 13 }}>
                  {[
                    ["#6340df", "Tím"],
                    ["#2564c2", "Xanh dương"],
                    ["#067257", "Xanh lá"],
                    ["#955107", "Cam"],
                    ["#b52b7d", "Hồng"],
                  ].map(([color, label]) => (
                    <button
                      key={color}
                      aria-label={label}
                      title={label}
                      aria-pressed={preferences.color === color}
                      className={
                        "color-choice " +
                        (preferences.color === color ? "active" : "")
                      }
                      style={{ background: color }}
                      onClick={() => update("color", color)}
                    />
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <Field label="Font chữ">
                  <select
                    value={preferences.font}
                    onChange={(e) => update("font", e.target.value)}
                  >
                    <option>Be Vietnam Pro</option>
                    <option>Inter</option>
                    <option>Plus Jakarta Sans</option>
                  </select>
                </Field>
                <Field label="Bo góc">
                  <select
                    value={preferences.radius}
                    onChange={(e) => update("radius", e.target.value)}
                  >
                    <option value="small">Nhỏ</option>
                    <option value="medium">Vừa</option>
                    <option value="large">Lớn</option>
                  </select>
                </Field>
              </div>
              <p className="hint">
                Tùy chỉnh được áp dụng ngay và lưu trên trình duyệt này.
              </p>
              <div>
                <Button
                  variant="outline"
                  onClick={() => setPreferences(defaultPreferences)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
            </div>
          ) : active === "notifications" ? (
            <div>
              <div className="setting-row">
                <div>
                  <h3>Hiển thị số thông báo chưa đọc</h3>
                  <p>Quản lý cách hiển thị thông báo trên thiết bị này.</p>
                </div>
                <button
                  role="switch"
                  aria-label="Hiển thị số thông báo chưa đọc"
                  aria-checked={preferences.notifications}
                  className={
                    "toggle " + (preferences.notifications ? "on" : "")
                  }
                  onClick={() =>
                    update("notifications", !preferences.notifications)
                  }
                >
                  <span />
                </button>
              </div>
              <p className="hint">
                Các nhắc nhở lịch học và deadline được quản lý bởi backend. Bạn
                có thể đọc thông báo tại biểu tượng chuông.
              </p>
            </div>
          ) : active === "profile" ? (
            <div className="stack">
              <p className="muted">
                Cập nhật thông tin cá nhân, xem bảng điểm và danh sách môn học.
              </p>
              <div>
                <Link className="btn btn-primary" to="/profile">
                  Mở hồ sơ
                </Link>
              </div>
            </div>
          ) : active === "sync" || active === "account" ? (
            <div className="stack">
              <p className="muted">
                Quản lý phiên kết nối IU, EDUX và Outlook trong trang Đồng bộ.
              </p>
              <div>
                <Link className="btn btn-primary" to="/sync">
                  Quản lý kết nối
                </Link>
              </div>
            </div>
          ) : (
            <div className="setting-row">
              <span>Tiếng Việt</span>
              <Badge label="Đang sử dụng" variant="success" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
