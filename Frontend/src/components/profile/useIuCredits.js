import { useCallback, useEffect, useRef, useState } from 'react';
import { syncApi } from '../../api';
import { unwrapResponse } from '../../api/apiClient';

export default function useIuCredits(studentCode, officialTotal, requiredCredits) {
  const [state, setState] = useState({ busy: false, message: '', needsConnection: false });
  const mounted = useRef(false), locked = useRef(false), attempted = useRef(null);
  const currentStudent = useRef(studentCode);
  currentStudent.current = studentCode;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const update = useCallback(async (interactive = true) => {
    if (locked.current || !currentStudent.current) return;
    const owner = currentStudent.current;
    const publish = value => {
      if (mounted.current && currentStudent.current === owner) setState(value);
    };
    locked.current = true;
    publish({ busy: true, message: 'Đang kiểm tra và cập nhật tín chỉ IU…', needsConnection: false });
    try {
      let connection = unwrapResponse(await syncApi.iu.status());
      const bridge = window.__uniStudyIU;
      if (!connection?.connected && bridge?.restoreIU) connection = await bridge.restoreIU();
      if (!mounted.current || currentStudent.current !== owner) return;
      if (!connection?.connected && interactive) {
        if (!await syncApi.iu.connect()) {
          publish({ busy: false, needsConnection: true, message: 'Kết nối IU tại trang Đồng bộ để lấy tổng tín chỉ chương trình.' });
          return;
        }
        connection = { connected: true };
      }
      if (!connection?.connected) {
        publish({ busy: false, needsConnection: true, message: 'Chưa kết nối IU để cập nhật tổng tín chỉ chương trình.' });
        return;
      }
      // Login can remain open while the user navigates away. Never start a
      // write for a profile that is no longer on screen.
      if (!mounted.current || currentStudent.current !== owner) return;
      const result = unwrapResponse(await syncApi.iu.curriculum());
      if (result?.persisted !== true) throw new Error('Chưa xác nhận được kết quả cập nhật tín chỉ. Hãy thử lại.');
      window.dispatchEvent(new Event('workspace-updated'));
      publish({ busy: false, needsConnection: false, message: result.totalProgramCredits > 0
        ? '' : 'IU chưa cung cấp tổng tín chỉ chương trình. Bạn có thể thử lại hoặc nhập tổng tín chỉ.' });
    } catch (error) {
      const expired = [401, 403].includes(error.response?.status);
      publish({ busy: false, needsConnection: expired, message: expired
        ? 'Phiên IU đã hết hạn. Bấm đồng bộ để kết nối lại.'
        : error.response?.data?.message || error.message || 'Chưa cập nhật được tín chỉ từ IU. Hãy thử lại.' });
    } finally {
      locked.current = false;
    }
  }, []);

  useEffect(() => {
    if (!studentCode || officialTotal > 0 && requiredCredits != null || attempted.current === studentCode) return;
    attempted.current = studentCode;
    void update(false);
  }, [studentCode, officialTotal, requiredCredits, update]);

  return { ...state, update, needsUpdate: !(officialTotal > 0) || requiredCredits == null };
}
