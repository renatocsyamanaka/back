const dayjs = require('dayjs');
const { Op } = require('sequelize');

const {
  User,
  AutoInventoryCycle,
  AutoInventoryResponse,
  AutoInventoryResponseItem,
} = require('../models');

const autoInventoryMailService = require('../services/autoInventoryMailService');

async function createMonthlyCycle() {
  try {
    const now = dayjs();

    const month = now.month() + 1;
    const year = now.year();

    const exists = await AutoInventoryCycle.findOne({
      where: { month, year },
    });

    if (exists) {
      console.log('[AUTO INVENTORY] Ciclo já existe.');
      return;
    }

    const cycle = await AutoInventoryCycle.create({
      month,
      year,
      status: 'ABERTO',
      sendDate: new Date(),
    });

    const providers = await User.findAll({
      where: {
        isActive: true,
        email: {
          [Op.ne]: null,
        },
      },
    });

    for (const provider of providers) {
      await AutoInventoryResponse.create({
        cycleId: cycle.id,
        providerId: provider.id,
        token: require('crypto')
          .randomBytes(32)
          .toString('hex'),
        status: 'PENDENTE',
      });
    }

    console.log('[AUTO INVENTORY] Ciclo criado.');
  } catch (err) {
    console.error('[AUTO INVENTORY] Erro ao criar ciclo:', err);
  }
}

async function sendInitialEmails() {
  try {
    const now = dayjs();

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: now.month() + 1,
        year: now.year(),
      },
    });

    if (!cycle) return;

    const responses = await AutoInventoryResponse.findAll({
      where: {
        cycleId: cycle.id,
      },
      include: [
        {
          model: User,
          as: 'provider',
        },
      ],
    });

    for (const response of responses) {
      if (!response.provider?.email) continue;

      await autoInventoryMailService.sendInventoryRequest(
        response
      );

      console.log(
        `[AUTO INVENTORY] E-mail enviado para ${response.provider.email}`
      );
    }
  } catch (err) {
    console.error(
      '[AUTO INVENTORY] Erro envio inicial:',
      err
    );
  }
}

async function sendPendingReminders() {
  try {
    const now = dayjs();

    const cycle = await AutoInventoryCycle.findOne({
      where: {
        month: now.month() + 1,
        year: now.year(),
      },
    });

    if (!cycle) return;

    const responses = await AutoInventoryResponse.findAll({
      where: {
        cycleId: cycle.id,
        status: {
          [Op.in]: ['PENDENTE', 'PARCIAL'],
        },
      },
      include: [
        {
          model: User,
          as: 'provider',
        },
      ],
    });

    for (const response of responses) {
      if (!response.provider?.email) continue;

      const lastReminder = response.reminderSentAt;

      if (
        lastReminder &&
        dayjs(lastReminder).isSame(dayjs(), 'day')
      ) {
        continue;
      }

      await autoInventoryMailService.sendReminder(
        response
      );

      response.reminderSentAt = new Date();

      await response.save();

      console.log(
        `[AUTO INVENTORY] Reminder enviado para ${response.provider.email}`
      );
    }
  } catch (err) {
    console.error(
      '[AUTO INVENTORY] Erro reminder:',
      err
    );
  }
}

async function detectPartialResponses() {
  try {
    const responses = await AutoInventoryResponse.findAll({
      where: {
        status: {
          [Op.in]: ['PENDENTE', 'PARCIAL'],
        },
      },
      include: [
        {
          model: AutoInventoryResponseItem,
          as: 'items',
        },
      ],
    });

    for (const response of responses) {
      const total = response.items.length;

      const preenchidos = response.items.filter(
        (i) =>
          i.quantidade !== null &&
          i.quantidade !== undefined
      ).length;

      if (preenchidos === 0) {
        response.status = 'PENDENTE';
      } else if (preenchidos < total) {
        response.status = 'PARCIAL';
      } else {
        response.status = 'COMPLETO';

        if (!response.completedMailSentAt) {
          await autoInventoryMailService.sendCompleted(
            response
          );

          response.completedMailSentAt =
            new Date();
        }
      }

      await response.save();
    }
  } catch (err) {
    console.error(
      '[AUTO INVENTORY] Erro validação:',
      err
    );
  }
}

async function runAutoInventoryJob() {
  const today = dayjs().date();

  try {
    // Dia 20 cria ciclo + envia
    if (today === 20) {
      await createMonthlyCycle();
      await sendInitialEmails();
    }

    // Após dia 20 faz lembretes
    if (today >= 21) {
      await detectPartialResponses();
      await sendPendingReminders();
    }

    console.log('[AUTO INVENTORY] Job executado.');
  } catch (err) {
    console.error('[AUTO INVENTORY]', err);
  }
}

module.exports = {
  runAutoInventoryJob,
};