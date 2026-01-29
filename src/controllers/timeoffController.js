const { TimeOff, OvertimeEntry } = require('../models');
const { ok, created, bad } = require('../utils/responses');

module.exports = {
  async request(req, res) {
    const { userId, startDate, endDate, type, usesBankHours, notes, minutesDeducted } = req.body;
    if (!userId || !startDate || !endDate) return bad(res, 'Campos obrigatórios ausentes');

    // Se usa banco de horas, lançar um débito pendente (negativo). Aprovou? transforma em aprovado.
    const row = await TimeOff.create({ userId, startDate, endDate, type, usesBankHours, notes, minutesDeducted: minutesDeducted || 0 });

    // estratégia simples: se usesBankHours e minutesDeducted > 0, cria OvertimeEntry negativo PENDING
    if (usesBankHours && (minutesDeducted || 0) > 0) {
      await OvertimeEntry.create({
        userId, date: startDate, minutes: -Math.abs(minutesDeducted), reason: `Folga (${type})`, status: 'PENDING'
      });
    }
    return created(res, row);
  }
};
