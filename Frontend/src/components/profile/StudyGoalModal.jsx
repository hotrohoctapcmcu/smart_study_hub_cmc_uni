import { useEffect, useState } from "react";
import { Button, Field, Modal } from "../common/ui";

export default function StudyGoalModal({ isOpen, onClose, preferences, programCredits, onSave }) {
  const [gpa, setGpa] = useState(8);
  const [credits, setCredits] = useState("");
  useEffect(() => {
    if (isOpen) { setGpa(preferences.gpaGoal || 8); setCredits(programCredits > 0 ? programCredits : preferences.totalCredits || ""); }
  }, [isOpen, preferences, programCredits]);
  return <Modal isOpen={isOpen} onClose={onClose} title="Mục tiêu học tập">
    <form onSubmit={(event) => { event.preventDefault(); onSave({ gpaGoal: Number(gpa), totalCredits: programCredits > 0 ? preferences.totalCredits ?? null : credits ? Number(credits) : null }); }}>
      <div className="stack">
        <Field label="GPA mục tiêu (hệ 10)" type="number" min="1" max="10" step="0.1" required value={gpa} onChange={(event) => setGpa(event.target.value)} />
        <Field label={programCredits > 0 ? "Tổng tín chỉ chương trình từ IU" : "Tổng tín chỉ chương trình (tùy chọn)"} type="number" min="1" max="500" readOnly={programCredits > 0} placeholder="Nhập theo chương trình đào tạo" value={credits} onChange={(event) => setCredits(event.target.value)} />
        <p className="profile-modal-note">{programCredits > 0 ? 'Tổng tín chỉ đã được đồng bộ từ IU. Bạn có thể cập nhật GPA mục tiêu tại đây.' : 'Tổng tín chỉ sẽ được cập nhật khi đồng bộ được chương trình từ IU. Bạn cũng có thể nhập theo chương trình đào tạo; thông tin tự nhập được lưu trên thiết bị này.'}</p>
      </div>
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Hủy</Button><Button type="submit">Lưu mục tiêu</Button></div>
    </form>
  </Modal>;
}
