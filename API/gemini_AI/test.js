
const path = require("path");
const store = require("./store");
const ai = require("./index");

async function main() {
    store.init(path.join(__dirname, "data"));

    console.log("Status:", ai.status());

    const result = await ai.ask("Đạo hàm là gì?");
    console.log(result);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
