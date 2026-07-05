import fs from "node:fs";
import { publishSlots, slotForCron } from "./publish_slot_policy.mjs";

const primaryWorkflow = fs.readFileSync(".github/workflows/continuous-indexing.yml", "utf8");
const fallbackWorkflow = fs.readFileSync(".github/workflows/hosted-template-fallback.yml", "utf8");
const errors = [];

for (const slot of publishSlots) {
  if (!primaryWorkflow.includes(`cron: "${slot.primaryCron}"`)) {
    errors.push(`primary workflow missing slot ${slot.slot} cron ${slot.primaryCron}`);
  }
  if (!fallbackWorkflow.includes(`cron: "${slot.fallbackCron}"`)) {
    errors.push(`fallback workflow missing slot ${slot.slot} cron ${slot.fallbackCron}`);
  }
  if (slot.fallbackKst <= slot.primaryKst) {
    errors.push(`fallback slot ${slot.slot} must run after primary: ${slot.primaryKst} -> ${slot.fallbackKst}`);
  }
  if (slotForCron(slot.primaryCron, "primary")?.slot !== slot.slot) {
    errors.push(`primary cron lookup failed for slot ${slot.slot}`);
  }
  if (slotForCron(slot.fallbackCron, "fallback")?.slot !== slot.slot) {
    errors.push(`fallback cron lookup failed for slot ${slot.slot}`);
  }
}

if (!primaryWorkflow.includes("node tools/select_publish_slot.mjs --workflow primary")) {
  errors.push("primary workflow is not using tools/select_publish_slot.mjs");
}
if (!fallbackWorkflow.includes("node tools/select_publish_slot.mjs --workflow fallback")) {
  errors.push("fallback workflow is not using tools/select_publish_slot.mjs");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`publish slot policy verified: ${publishSlots.length} slots`);
