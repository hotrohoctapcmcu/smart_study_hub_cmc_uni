import { Save } from "lucide-react";
import { Button, Field, Modal } from "../common/ui";
import { planningNow } from "../../utils/planning";

export default function ProfileEditModal({ isOpen, onClose, form, setForm, onSubmit, busy }) {
  const field = (key) => ({
    value: form[key] || "",
    onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa hồ sơ" size="lg">
      <form onSubmit={onSubmit}>
        <div className="form-grid profile-edit-form">
          <Field label="Họ và tên" required {...field("fullName")} />
          <Field label="Mã sinh viên" required {...field("studentCode")} />
          <Field label="Lớp" readOnly {...field("className")} />
          <Field label="Email trường" type="email" {...field("email")} />
          <Field label="Ngành học" required {...field("major")} />
          <Field label="Số điện thoại" type="tel" {...field("phone")} />
          <Field label="Ngày sinh" type="date" max={planningNow().date} {...field("dateOfBirth")} />
          <Field label="Giới tính"><select {...field("gender")}><option value="">Chưa cập nhật</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></Field>
          <div className="full"><Field label="Địa chỉ" {...field("address")} /></div>
          <div className="full"><Field label="Slogan cá nhân" maxLength={120} placeholder="Ngày hôm nay tốt hơn ngày hôm qua." {...field("slogan")} /></div>
        </div>
        <p className="profile-modal-note">Giới tính, địa chỉ và slogan được lưu trên thiết bị này.</p>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={busy}><Save size={15} /> {busy ? "Đang lưu..." : "Lưu thay đổi"}</Button>
        </div>
      </form>
    </Modal>
  );
}
