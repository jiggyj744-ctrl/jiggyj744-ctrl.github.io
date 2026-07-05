export const publishSlots = [
  {
    slot: 0,
    primaryCron: "17 23 * * *",
    fallbackCron: "27 23 * * *",
    primaryKst: "08:17",
    fallbackKst: "08:27",
  },
  {
    slot: 1,
    primaryCron: "43 1 * * *",
    fallbackCron: "57 1 * * *",
    primaryKst: "10:43",
    fallbackKst: "10:57",
  },
  {
    slot: 2,
    primaryCron: "11 4 * * *",
    fallbackCron: "23 4 * * *",
    primaryKst: "13:11",
    fallbackKst: "13:23",
  },
  {
    slot: 3,
    primaryCron: "37 6 * * *",
    fallbackCron: "49 6 * * *",
    primaryKst: "15:37",
    fallbackKst: "15:49",
  },
  {
    slot: 4,
    primaryCron: "9 9 * * *",
    fallbackCron: "21 9 * * *",
    primaryKst: "18:09",
    fallbackKst: "18:21",
  },
  {
    slot: 5,
    primaryCron: "51 12 * * *",
    fallbackCron: "7 13 * * *",
    primaryKst: "21:51",
    fallbackKst: "22:07",
  },
];

export const primaryJitterSeconds = 1800;
export const fallbackJitterSeconds = 2700;

export function kstDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function selectedPublishSlot(date = kstDate()) {
  return stableIndex(String(date), publishSlots.length);
}

export function slotForCron(cron, workflow) {
  const key = workflow === "fallback" ? "fallbackCron" : "primaryCron";
  return publishSlots.find((slot) => slot[key] === cron) || null;
}

export function decidePublishSlot({ workflow, eventName, eventSchedule, date = kstDate() }) {
  if (eventName !== "schedule") {
    return {
      shouldPublish: true,
      reason: "manual",
      kstDate: date,
      selectedSlot: selectedPublishSlot(date),
      currentSlot: null,
    };
  }

  const selectedSlot = selectedPublishSlot(date);
  const current = slotForCron(eventSchedule, workflow);
  const currentSlot = current ? current.slot : -1;
  const shouldPublish = currentSlot === selectedSlot;
  return {
    shouldPublish,
    reason: shouldPublish ? `selected-slot-${selectedSlot}` : `skip-slot-${currentSlot}-selected-${selectedSlot}`,
    kstDate: date,
    selectedSlot,
    currentSlot,
  };
}

export function buildSchedulePreview(days = 14, start = new Date()) {
  const rows = [];
  const startDate = parseKstDate(kstDate(start));
  for (let i = 0; i < days; i += 1) {
    const date = addKstDays(startDate, i);
    const dateText = kstDate(date);
    const slot = publishSlots[selectedPublishSlot(dateText)];
    rows.push({
      kstDate: dateText,
      selectedSlot: slot.slot,
      primaryKst: slot.primaryKst,
      primaryWindowKst: `${slot.primaryKst}~+${Math.round(primaryJitterSeconds / 60)}분`,
      fallbackKst: slot.fallbackKst,
      fallbackWindowKst: `${slot.fallbackKst}~+${Math.round(fallbackJitterSeconds / 60)}분`,
      primaryCron: slot.primaryCron,
      fallbackCron: slot.fallbackCron,
    });
  }
  return rows;
}

function addKstDays(startDate, days) {
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function parseKstDate(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function stableIndex(value, modulo) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return modulo ? hash % modulo : 0;
}
