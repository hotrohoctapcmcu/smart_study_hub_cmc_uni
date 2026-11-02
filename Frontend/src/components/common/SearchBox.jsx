import "./SearchBox.css";

export default function SearchBox({
  placeholder = "Tìm kiếm...",
  value,
  onChange,
  className = "",
}) {
  return (
    <div className={`search-box relative ${className}`}>
      <svg
        className="search-icon absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value || ""}
        onChange={onChange}
        className="search-input w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        aria-label={placeholder}
      />
    </div>
  );
}
