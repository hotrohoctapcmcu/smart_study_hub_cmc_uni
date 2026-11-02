'use strict';

const { dataHandler, binaryHandler } = require('../utils/response');

function createHocTapAiController(service) {
    return {
        conversations: dataHandler(() => service.conversations()),
        conversation: dataHandler(req => service.conversation(req.params.id)),
        quizzes: dataHandler(() => service.quizzes()),
        generateQuiz: dataHandler(req => service.generateQuiz(req.body)),
        quiz: dataHandler(req => service.quiz(req.params.id)),
        submitQuiz: dataHandler(req => service.submitQuiz(req.params.id, req.body)),
        weaknesses: dataHandler(() => service.weaknesses()),
        analyzeWeaknesses: dataHandler(() => service.analyzeWeaknesses()),
        confirmExamPlan: dataHandler(req => service.confirmExamPlan(req.body)),
        leaveDrafts: dataHandler(() => service.leaveDrafts()),
        createLeave: dataHandler(req => service.saveLeave(null, req.body)),
        updateLeave: dataHandler(req => service.saveLeave(req.params.id, req.body)),
        exportLeave: binaryHandler(async (req, res) => {
            const buffer = await service.exportLeave(req.params.id);
            res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                .set('Content-Disposition', 'attachment; filename="don-xin-nghi-hoc.docx"').send(buffer);
        })
    };
}

module.exports = { createHocTapAiController };
