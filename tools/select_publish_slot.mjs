import fs from "node:fs";
import { decidePublishSlot } from "./publish_slot_policy.mjs";

const workflow = argValue("--workflow") || "primary";
const eventName = process.env.GITHUB_EVENT_NAME || process.env.EVENT_NAME || "manual";
const eventSchedule = process.env.GITHUB_EVENT_SCHEDULE || process.env.EVENT_SCHEDULE || "";
const decision = decidePublishSlot({ workflow, eventName, eventSchedule });

writeOutput("should_publish", decision.shouldPublish ? "1" : "0");
writeOutput("reason", decision.reason);
writeOutput("kst_date", decision.kstDate);
writeOutput("selected_slot", String(decision.selectedSlot));
writeOutput("current_slot", decision.currentSlot === null ? "" : String(decision.currentSlot));

console.log(
  [
    `workflow=${workflow}`,
    `event=${eventName}`,
    `schedule=${eventSchedule || "-"}`,
    `kst_date=${decision.kstDate}`,
    `current_slot=${decision.currentSlot === null ? "-" : decision.currentSlot}`,
    `selected_slot=${decision.selectedSlot}`,
    `should_publish=${decision.shouldPublish ? "1" : "0"}`,
    `reason=${decision.reason}`,
  ].join(" "),
);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}
