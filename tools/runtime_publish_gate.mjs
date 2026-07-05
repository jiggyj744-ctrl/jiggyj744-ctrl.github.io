import { publishSlots, selectedPublishSlot, kstDate } from "./publish_slot_policy.mjs";

const now = new Date();
const date = kstDate(now);
const selected = publishSlots[selectedPublishSlot(date)];
const current = currentKstTime(now);
const currentMinutes = toMinutes(current.time);
const startMinutes = toMinutes(selected.primaryKst);
const force = process.env.FORCE_PUBLISH === "1";
const allowed = force || currentMinutes >= startMinutes;

console.error(
  [
    `runtime_publish_gate date=${date}`,
    `slot=${selected.slot}`,
    `current_kst=${current.time}`,
    `primary_start=${selected.primaryKst}`,
    `fallback_start=${selected.fallbackKst}`,
    `allowed=${allowed ? "1" : "0"}`,
    `reason=${force ? "force" : allowed ? "selected-slot-open" : "before-selected-slot"}`,
  ].join(" "),
);
console.log(allowed ? "1" : "0");

function currentKstTime(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return { time: `${parts.hour}:${parts.minute}` };
}

function toMinutes(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}
