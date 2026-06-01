const { spawn } = require("child_process");

const commands = [
  { name: "backend", command: "npm", args: ["--prefix", "backend", "run", "dev"] },
  { name: "frontend", command: "npm", args: ["--prefix", "frontend", "run", "dev"] },
];

let shuttingDown = false;
const children = [];

const stopChildren = () => {
  children.forEach((child) => {
    if (!child.killed) child.kill("SIGTERM");
  });
};

commands.forEach(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopChildren();
    process.exit(code ?? (signal ? 1 : 0));
  });

  children.push(child);
});

process.on("SIGINT", () => {
  shuttingDown = true;
  stopChildren();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  stopChildren();
  process.exit(0);
});
