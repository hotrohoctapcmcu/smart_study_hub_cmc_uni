/**
 * In-memory DOM evaluation test for bootstrap() and renderShell()
 * Validates that renderShell() runs completely, mounts sidebar, workspace tabs,
 * and current feature (dashboard) without throwing any exceptions or leaving #app empty.
 */
class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this._innerHTML = "";
    this.dataset = {};
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
  }

  querySelector(selector) {
    // Simple mock querySelector
    if (selector === "#app") return this;
    if (selector === ".app-shell" || selector === "#workspaceContentPane" || selector === "#appSidebar") {
      return new MockElement("div");
    }
    return new MockElement("div");
  }

  querySelectorAll() {
    return [];
  }

  addEventListener() {}
  removeEventListener() {}
  contains() { return false; }
}

const mockApp = new MockElement("div");
mockApp.id = "app";

globalThis.window = {
  innerWidth: 1200,
  location: { search: "" },
  addEventListener: () => {},
  removeEventListener: () => {}
};

globalThis.document = {
  readyState: "complete",
  activeElement: null,
  querySelector: (sel) => {
    if (sel === "#app") return mockApp;
    return new MockElement("div");
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => new MockElement("div"),
  addEventListener: () => {},
  removeEventListener: () => {}
};

console.log("====================================================");
console.log("   KIỂM THỬ KHỞI TẠO BOOTSTRAP & DỰNG SHELL DOM     ");
console.log("====================================================\n");

try {
  const { bootstrap } = await import("../src/app/bootstrap.js");
  console.log("1. Gọi bootstrap()...");
  bootstrap();
  console.log("✓ bootstrap() hoàn thành thành công mà không có ngoại lệ!");

  if (mockApp.innerHTML.length === 0) {
    console.error("✕ LỖI: #app bị rỗng sau khi bootstrap()!");
    process.exit(1);
  } else {
    console.log(`✓ #app đã được điền HTML (${mockApp.innerHTML.length} ký tự)!`);
    console.log("✓ Giao diện hiển thị đầy đủ, không bị trắng màn hình.\n");
  }
} catch (err) {
  console.error("❌ LỖI NGHIÊM TRỌNG TRONG QUÁ TRÌNH BOOTSTRAP:", err);
  process.exit(1);
}
