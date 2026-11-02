import { useEffect, useState } from "react";
import { documentApi } from "../../api";
import { ErrorState, LoadingSkeleton } from "../common/ui";

export default function DocumentPreview({ document }) {
  const [attempt, setAttempt] = useState(0);
  const [file, setFile] = useState({ loading: true, error: null, url: null, mimeType: "" });
  useEffect(() => {
    let canceled = false;
    let objectUrl;
    setFile({ loading: true, error: null, url: null, mimeType: "" });
    documentApi.download(document.id).then((response) => {
      if (canceled) return;
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      objectUrl = URL.createObjectURL(blob);
      setFile({ loading: false, error: null, url: objectUrl, mimeType: blob.type });
    }).catch((error) => {
      if (!canceled) setFile({ loading: false, error, url: null, mimeType: "" });
    });
    return () => {
      canceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id, attempt]);

  if (file.loading) return <LoadingSkeleton />;
  if (file.error) return <ErrorState title="Không thể xem tài liệu" error={file.error} onRetry={() => setAttempt((n) => n + 1)} />;
  const type = String(document.type || document.title?.split(".").at(-1) || "").toLowerCase();
  const pdf = type === "pdf" || type === "application/pdf" || file.mimeType === "application/pdf";
  const image = /^(png|jpe?g)$/.test(type) || /^image\/(png|jpe?g)$/.test(file.mimeType);
  return (
    <div className="stack">
      {pdf ? (
        <iframe title={document.title} src={file.url} style={{ width: "100%", height: "65vh", border: 0 }} />
      ) : image ? (
        <img src={file.url} alt={document.title} style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }} />
      ) : (
        <p>Định dạng này có thể mở bằng ứng dụng trên máy.</p>
      )}
      <a className="btn btn-primary" href={file.url} download={document.title}>
        {pdf || image ? "Tải tài liệu" : "Tải xuống để xem"}
      </a>
    </div>
  );
}
