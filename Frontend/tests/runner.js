/**
 * Test Runner - Sprint 1 Automated Suite
 */
console.log("====================================================");
console.log("       UNISTUDY CMC SPRINT 1 - AUTOMATED TESTS      ");
console.log("====================================================\n");

async function runAllTests() {
  try {
    await import("./conflicts.test.js");
    await import("./date.test.js");
    await import("./selfstudy-crud.test.js");
    await import("./integration.test.js");
    await import("./iu-sync-flow.test.js");
    await import("./pomodoro.test.js");
    const { runStudyPlannerTests } = await import("./study-planner.test.js");
    await runStudyPlannerTests();
    console.log("====================================================");
    console.log("      TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT (ALL PASS)     ");
    console.log("====================================================");
  } catch (err) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err.message);
    process.exit(1);
  }
}

runAllTests();
