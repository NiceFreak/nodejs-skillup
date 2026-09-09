import path from "node:path";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let event;
try {
  event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
} catch {
  process.stderr.write("Protected-content guard could not parse hook input.\n");
  process.exit(2);
}

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const protectedRoot = path.resolve(projectRoot, "week13-rag/eval/holdout");
const input = event.tool_input || {};

function isProtectedPath(candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const resolved = path.resolve(projectRoot, candidate);
  return resolved === protectedRoot || resolved.startsWith(`${protectedRoot}${path.sep}`);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

if ([input.file_path, input.path, input.notebook_path].some(isProtectedPath)) {
  deny("Direct access to W13 holdout content is blocked in normal agent sessions.");
} else if (
  event.tool_name === "Bash" &&
  typeof input.command === "string" &&
  (input.command.includes("week13-rag/eval/holdout") || input.command.includes(protectedRoot))
) {
  deny("Shell access that names the W13 holdout path is blocked; use the frozen verifier instead.");
}
