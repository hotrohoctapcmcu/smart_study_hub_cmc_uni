import { useEffect, useState } from "react";
import { Button, Field, Modal } from "../common/ui";

export default function StudyGoalModal({ isOpen, onClose, preferences, onSave }) {
  const [gpa, setGpa] = useState(8);
  const [credits, setCredits] = useState("");
  useEffect(() => {
    if (isOpen) { setGpa(preferences.gpaGoal || 8); setCredits(preferences.totalCredits || ""); }
  }, [isOpen, preferences]);
  return <Modal isOpen={isOpen} onClose={onClose} title="Mục tiêu học tập">
    <form onSubmit={(event) => { event.preventDefault(); onSave({ gpaGoal: Number(gpa), totalCredits: credits ? Number(credits) : null }); }}>
      <div className="stack">
        <Field label="GPA mục tiêu (hệ 10)" type="number" min="1" max="10" step="0.1" required value={gpa} onChange={(event) => setGpa(event.target.value)} />
        <Field label="Tổng tín chỉ chương trình (tùy chọn)" type="number" min="1" max="500" placeholder="Nhập theo chương trình đào tạo" value={credits} onChange={(event) => setCredits(event.target.value)} />
        <p className="profile-modal-note">Nếu chưa nhập tổng tín chỉ, tiến độ sẽ dựa trên các môn đã đồng bộ. Mục tiêu được lưu trên thiết bị này.</p>
      </div>
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Hủy</Button><Button type="submit">Lưu mục tiêu</Button></div>
    </form>
  </Modal>;
}
