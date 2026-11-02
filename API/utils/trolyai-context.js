'use strict';

function stringifyForAi(value) {
    return JSON.stringify(value);
}

function compactContext(context) {
    return {
        profile: context.profile,
        generatedAt: context.generatedAt,
        timezone: context.timezone,
        timetable: context.timetable,
        studySchedules: context.studySchedules,
        assignments: context.assignments,
        exams: context.exams,
        grades: context.grades,
        documents: context.documents,
        notes: context.notes,
        sources: context.sources
    };
}

function progressAvailability(progress) {
    const entries = [];
    const walk = (value, path = "") => {
        if (value && typeof value === "object") {
            for (const [key, item] of Object.entries(value)) walk(item, path ? `${path}.${key}` : key);
        } else if (value !== null && value !== undefined && value !== "") {
            entries.push({ path, value });
        }
    };
    walk(progress);

    const paths = entries.map(entry => entry.path.toLowerCase());
    const has = regex => paths.some(path => regex.test(path));
    return {
        hasData: entries.some(entry => typeof entry.value === "number"),
        presentFields: entries.map(entry => entry.path).slice(0, 80),
        unavailableMetrics: [
            ["studyTime", /study.*(time|minute|hour|second)|actual.*(minute|hour|second)/],
            ["completedSessions", /session/],
            ["taskCompletion", /task|completion|completed/],
            ["grades", /grade|score|gpa|điểm/]
        ].filter(([, regex]) => !has(regex)).map(([name]) => name)
    };
}

function contextOptions(body) { return { studyData: body?.studyData }; }

module.exports = { stringifyForAi, compactContext, progressAvailability, contextOptions };
