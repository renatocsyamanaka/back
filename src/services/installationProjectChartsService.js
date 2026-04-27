const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const ChartDataLabels = require('chartjs-plugin-datalabels');

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 620,
  height: 300,
  backgroundColour: '#eaf4ff',
  chartCallback: (ChartJS) => {
    ChartJS.register(ChartDataLabels);
  },
});

function normalizeProject(project) {
  return project?.toJSON ? project.toJSON() : project;
}

function getMainProductName(project) {
  const p = normalizeProject(project);

  return (
    p?.items?.[0]?.equipmentName ||
    p?.items?.[0]?.name ||
    p?.productName ||
    p?.product ||
    'Produto'
  );
}

function getChartColors(project, options = {}) {
  const p = normalizeProject(project);

  return {
    colorDone:
      options.colorDone ||
      p?.dailyReportColorDone ||
      '#b7b2b2',

    colorPending:
      options.colorPending ||
      p?.dailyReportColorPending ||
      '#a8d08d',

    background:
      options.background ||
      p?.dailyReportChartBackground ||
      '#eaf4ff',
  };
}

async function generateCharts(project, progressList = [], options = {}) {
  const p = normalizeProject(project);

  const total = Number(p?.trucksTotal || p?.equipmentsTotal || 0);
  const done = Number(p?.trucksDone || 0);
  const pending = Math.max(total - done, 0);

  const productName = getMainProductName(p);
  const { colorDone, colorPending, background } = getChartColors(p, options);

  const commonFontColor = '#333333';

  const pieBuffer = await chartJSNodeCanvas.renderToBuffer({
    type: 'pie',
    data: {
      labels: ['Concluído', 'Pendente'],
      datasets: [
        {
          data: [done, pending],
          backgroundColor: [colorDone, colorPending],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: false,
      layout: {
        padding: {
          top: 8,
          right: 8,
          bottom: 8,
          left: 8,
        },
      },
      plugins: {
        title: {
          display: true,
          text: `Percentual de Conclusão ${p?.requestedCity || ''}`.trim(),
          color: commonFontColor,
          font: {
            size: 16,
            weight: 'bold',
          },
          padding: {
            bottom: 8,
          },
        },
        legend: {
          position: 'top',
          labels: {
            color: commonFontColor,
            boxWidth: 18,
            font: {
              size: 11,
            },
          },
        },
        datalabels: {
          color: '#111111',
          font: {
            weight: 'bold',
            size: 13,
          },
          formatter: (value) => {
            const n = Number(value || 0);
            return n > 0 ? n : '';
          },
        },
      },
    },
  });

  const barBuffer = await chartJSNodeCanvas.renderToBuffer({
    type: 'bar',
    data: {
      labels: [productName],
      datasets: [
        {
          label: 'Concluído',
          data: [done],
          backgroundColor: colorDone,
          borderWidth: 0,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.7,
        },
        {
          label: 'Pendente',
          data: [pending],
          backgroundColor: colorPending,
          borderWidth: 0,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: false,
      layout: {
        padding: {
          top: 25,
          right: 12,
          bottom: 8,
          left: 8,
        },
      },
      plugins: {
        title: {
          display: true,
          text: 'Equipamentos Instalados',
          color: commonFontColor,
          font: {
            size: 16,
            weight: 'bold',
          },
          padding: {
            bottom: 12,
          },
        },
        legend: {
          position: 'bottom',
          labels: {
            color: commonFontColor,
            boxWidth: 18,
            font: {
              size: 11,
            },
          },
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#111111',
          font: {
            weight: 'bold',
            size: 13,
          },
          formatter: (value) => {
            const n = Number(value || 0);
            return n > 0 ? n : '';
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: commonFontColor,
            font: {
              weight: 'bold',
              size: 11,
            },
          },
          grid: {
            display: false,
          },
          border: {
            display: true,
            color: '#555555',
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(done, pending, 1) + 2,
          ticks: {
            color: '#666666',
            precision: 0,
            stepSize: 1,
          },
          grid: {
            color: '#d9e2ea',
          },
          border: {
            display: false,
          },
        },
      },
    },
  });

  return {
    pie: pieBuffer,
    bar: barBuffer,
    meta: {
      total,
      done,
      pending,
      productName,
      colorDone,
      colorPending,
      background,
    },
  };
}

module.exports = {
  generateCharts,
};