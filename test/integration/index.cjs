const path = require("node:path");
const Mocha = require("mocha");

exports.run = () => {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 30000 });
  const suite = process.env.TODOFORGE_IT_SUITE === "untrusted" ? "untrusted.test.cjs" : "extension.test.cjs";
  mocha.addFile(path.join(__dirname, suite));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} integration tests failed`)) : resolve()));
  });
};
