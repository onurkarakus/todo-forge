const path = require("node:path");
const Mocha = require("mocha");

exports.run = () => {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 30000 });
  mocha.addFile(path.join(__dirname, "extension.test.cjs"));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} integration tests failed`)) : resolve()));
  });
};
