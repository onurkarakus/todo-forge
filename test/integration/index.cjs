const path = require("node:path");
const Mocha = require("mocha");

exports.run = () => {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 30000 });
  const suites = { untrusted: "untrusted.test.cjs", reload: "reload.test.cjs" };
  const suite = suites[process.env.TODOFORGE_IT_SUITE] ?? "extension.test.cjs";
  mocha.addFile(path.join(__dirname, suite));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} integration tests failed`)) : resolve()));
  });
};
