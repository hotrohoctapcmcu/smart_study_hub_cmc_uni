'use strict';

const studyContext = require('./study-context');
const { MIN_SESSION_MINUTES } = require('./trolyai-config');

function dateAt(date, time = "00:00") {
    return new Date(`${date}T${time}:00${studyContext.OFFSET}`);
}

function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

function minutes(time) {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
}

function timeFromMinutes(value) {
    const hour = Math.floor(value / 60);
    const minute = value % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function overlaps(startA, endA, startB, endB) {
    return minutes(startA) < minutes(endB) && minutes(endA) > minutes(startB);
}

function subtractInterval(slots, blockedStart, blockedEnd) {
    const blockedStartMinutes = minutes(blockedStart);
    const blockedEndMinutes = minutes(blockedEnd);
    if (blockedEndMinutes <= blockedStartMinutes) return slots;

    return slots.flatMap(slot => {
        const start = minutes(slot.start);
        const end = minutes(slot.end);
        if (end <= blockedStartMinutes || start >= blockedEndMinutes) return [slot];

        const pieces = [];
        if (blockedStartMinutes - start >= MIN_SESSION_MINUTES) {
            pieces.push({ ...slot, end: timeFromMinutes(blockedStartMinutes) });
        }
        if (end - blockedEndMinutes >= MIN_SESSION_MINUTES) {
            pieces.push({ ...slot, start: timeFromMinutes(blockedEndMinutes) });
        }
        return pieces;
    });
}

module.exports = { dateAt, addDays, minutes, timeFromMinutes, overlaps, subtractInterval };
