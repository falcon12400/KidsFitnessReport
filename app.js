const sampleText = `學號\t姓名\t測試日期\t柔軟度\t肌耐力\t心肺耐力\t平衡協調\t爆發力
1\t王小明\t2026-03-25\t78\t66\t82\t74\t69
2\t林小華\t2026-03-25\t85\t72\t77\t81\t75
3\t陳小安\t2026-03-25\t68\t79\t84\t70\t73`;

const defaultDescriptions = {
  柔軟度: "坐姿體前彎或其他伸展測驗",
  肌耐力: "仰臥起坐、撐體等重複性動作",
  心肺耐力: "跑走測驗或持續活動能力",
  平衡協調: "平衡、節奏、身體控制能力",
  爆發力: "立定跳遠或短時間力量輸出"
};

const idKeywords = ["學號", "編號", "id", "studentid", "seat"];
const nameKeywords = ["姓名", "名", "name", "studentname"];
const dateKeywords = ["日期", "測試日", "測驗日", "date"];
const noteKeywords = ["備註", "說明", "note", "remark"];

const pasteInputEl = document.getElementById("paste-input");
const parseButtonEl = document.getElementById("parse-button");
const loadSampleButtonEl = document.getElementById("load-sample-button");
const downloadPdfButtonEl = document.getElementById("download-pdf-button");
const statusTextEl = document.getElementById("status-text");
const studentCountEl = document.getElementById("student-count");
const studentTableHeadEl = document.getElementById("student-table-head");
const studentTableBodyEl = document.getElementById("student-table-body");
const studentSelectEl = document.getElementById("student-select");
const studentNameEl = document.getElementById("student-name");
const studentIdEl = document.getElementById("student-id");
const testDateEl = document.getElementById("test-date");
const averageScoreEl = document.getElementById("average-score");
const bestMetricEl = document.getElementById("best-metric");
const scoreGridEl = document.getElementById("score-grid");
const summaryNoteEl = document.getElementById("summary-note");
const reportDashboardEl = document.getElementById("report-dashboard");

const state = {
  columns: [],
  students: [],
  selectedIndex: 0
};

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function matchesKeyword(header, keywords) {
  const normalized = normalizeHeader(header);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function parseTsv(text) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("\t").map((cell) => cell.trim()));

  if (rows.length < 2) {
    throw new Error("至少需要 1 列欄位名稱與 1 列學生資料。");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1).filter((cells) => cells.some(Boolean));
  const idIndex = headers.findIndex((header) => matchesKeyword(header, idKeywords));
  const nameIndex = headers.findIndex((header) => matchesKeyword(header, nameKeywords));
  const dateIndex = headers.findIndex((header) => matchesKeyword(header, dateKeywords));
  const noteIndex = headers.findIndex((header) => matchesKeyword(header, noteKeywords));

  if (nameIndex === -1) {
    throw new Error("找不到姓名欄位。請確認第一列包含「姓名」或對應名稱。");
  }

  const metricIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => ![idIndex, nameIndex, dateIndex, noteIndex].includes(index));

  const students = dataRows.map((cells, rowIndex) => {
    const metrics = metricIndexes
      .map(({ header, index }) => {
        const rawValue = cells[index] ?? "";
        const score = Number(rawValue);
        return {
          label: header,
          score,
          rawValue,
          description: defaultDescriptions[header] || `${header} 測試結果`
        };
      })
      .filter((metric) => Number.isFinite(metric.score));

    if (metrics.length === 0) {
      throw new Error(`第 ${rowIndex + 2} 列沒有可用的數值欄位。`);
    }

    return {
      id: idIndex === -1 ? String(rowIndex + 1) : cells[idIndex] || String(rowIndex + 1),
      name: cells[nameIndex] || `學生 ${rowIndex + 1}`,
      testDate: dateIndex === -1 ? "" : cells[dateIndex] || "",
      note: noteIndex === -1 ? "" : cells[noteIndex] || "",
      metrics
    };
  });

  return { headers, students };
}

function getAverage(metrics) {
  const total = metrics.reduce((sum, metric) => sum + metric.score, 0);
  return Math.round((total / metrics.length) * 10) / 10;
}

function getBestMetric(metrics) {
  return metrics.reduce((best, metric) => (metric.score > best.score ? metric : best), metrics[0]);
}

function setStatus(message, isError = false) {
  statusTextEl.textContent = message;
  statusTextEl.classList.toggle("is-error", isError);
}

function renderStudentTable() {
  if (state.students.length === 0) {
    studentTableHeadEl.innerHTML = "";
    studentTableBodyEl.innerHTML = `<tr><td class="empty-state" colspan="6">目前沒有學生資料。</td></tr>`;
    studentCountEl.textContent = "0 位學生";
    studentSelectEl.innerHTML = `<option value="">目前沒有學生資料</option>`;
    return;
  }

  const metricHeaders = state.students[0].metrics.map((metric) => metric.label);
  const headCells = ["學號", "姓名", ...metricHeaders];
  studentTableHeadEl.innerHTML = `<tr>${headCells.map((header) => `<th>${header}</th>`).join("")}</tr>`;

  studentTableBodyEl.innerHTML = state.students
    .map((student, index) => {
      const metricCells = student.metrics
        .map((metric) => `<td>${metric.score}</td>`)
        .join("");
      const activeClass = index === state.selectedIndex ? "is-active" : "";
      return `
        <tr class="${activeClass}" data-index="${index}">
          <td>${student.id}</td>
          <td>${student.name}</td>
          ${metricCells}
        </tr>
      `;
    })
    .join("");

  studentCountEl.textContent = `${state.students.length} 位學生`;
}

function renderStudentSelect() {
  if (state.students.length === 0) {
    studentSelectEl.innerHTML = `<option value="">目前沒有學生資料</option>`;
    studentSelectEl.disabled = true;
    return;
  }

  studentSelectEl.disabled = false;
  studentSelectEl.innerHTML = state.students
    .map((student, index) => {
      const selected = index === state.selectedIndex ? "selected" : "";
      return `<option value="${index}" ${selected}>${student.id} ${student.name}</option>`;
    })
    .join("");
}

function renderSummary(student) {
  const average = getAverage(student.metrics);
  const bestMetric = getBestMetric(student.metrics);

  studentNameEl.textContent = student.name;
  studentIdEl.textContent = `學號 ${student.id}`;
  testDateEl.textContent = student.testDate ? `測試日 ${student.testDate}` : "測試日未提供";
  averageScoreEl.textContent = average.toFixed(1);
  bestMetricEl.textContent = `${bestMetric.label} ${bestMetric.score}`;
  summaryNoteEl.textContent =
    student.note ||
    "分數已先換算成同一尺度，較適合放在雷達圖比較。正式上線前，建議依年齡與性別建立標準分數規則。";

  scoreGridEl.innerHTML = student.metrics
    .map(
      (metric) => `
        <article class="score-card">
          <div class="score-label">${metric.label}</div>
          <div class="score-value">${metric.score}</div>
          <div class="score-desc">${metric.description}</div>
        </article>
      `
    )
    .join("");
}

function updateChart(student, mode = undefined) {
  radarChart.data.labels = student.metrics.map((metric) => metric.label);
  radarChart.data.datasets[0].data = student.metrics.map((metric) => metric.score);
  radarChart.update(mode);
}

function selectStudent(index, chartMode = undefined) {
  if (!state.students[index]) {
    return;
  }

  state.selectedIndex = index;
  renderStudentTable();
  renderStudentSelect();
  renderSummary(state.students[index]);
  updateChart(state.students[index], chartMode);
}

function applyParsedData(parsed) {
  state.columns = parsed.headers;
  state.students = parsed.students;
  state.selectedIndex = 0;
  renderStudentTable();
  renderStudentSelect();
  renderSummary(state.students[0]);
  updateChart(state.students[0]);
}

async function exportAllStudentsPdf() {
  if (state.students.length === 0) {
    setStatus("目前沒有可匯出的學生資料。", true);
    return;
  }

  downloadPdfButtonEl.disabled = true;
  setStatus("正在建立 PDF，學生數較多時需要幾秒鐘。");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const originalIndex = state.selectedIndex;

  try {
    for (let index = 0; index < state.students.length; index += 1) {
      selectStudent(index, "none");
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

      if (index > 0) {
        pdf.addPage("a4", "landscape");
      }

      const canvas = await window.html2canvas(reportDashboardEl, {
        backgroundColor: "#f5efe4",
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imageData = canvas.toDataURL("image/png");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - 12;
      const maxHeight = pageHeight - 12;
      const widthRatio = maxWidth / canvas.width;
      const heightRatio = maxHeight / canvas.height;
      const ratio = Math.min(widthRatio, heightRatio);
      const renderWidth = canvas.width * ratio;
      const renderHeight = canvas.height * ratio;
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imageData, "PNG", x, y, renderWidth, renderHeight);
    }

    pdf.save("kid-fitness-report.pdf");
    setStatus(`已完成 PDF 匯出，共 ${state.students.length} 位學生。`);
  } catch (error) {
    setStatus(`PDF 匯出失敗：${error.message}`, true);
  } finally {
    selectStudent(originalIndex, "none");
    downloadPdfButtonEl.disabled = false;
  }
}

const radarChart = new Chart(document.getElementById("fitnessRadar"), {
  type: "radar",
  data: {
    labels: [],
    datasets: [
      {
        label: "標準分數",
        data: [],
        fill: true,
        backgroundColor: "rgba(232, 111, 61, 0.18)",
        borderColor: "#e86f3d",
        borderWidth: 3,
        pointBackgroundColor: "#2f7f73",
        pointBorderColor: "#fffaf0",
        pointHoverBackgroundColor: "#fffaf0",
        pointHoverBorderColor: "#2f7f73",
        pointRadius: 4
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: "#1d2a2b",
        titleFont: { family: "Noto Sans TC" },
        bodyFont: { family: "Noto Sans TC" },
        callbacks: {
          label(context) {
            return ` 分數: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          backdropColor: "transparent",
          color: "#5d675d"
        },
        angleLines: {
          color: "rgba(29, 42, 43, 0.12)"
        },
        grid: {
          color: "rgba(29, 42, 43, 0.12)"
        },
        pointLabels: {
          color: "#1d2a2b",
          font: {
            family: "Noto Sans TC",
            size: 14,
            weight: "700"
          }
        }
      }
    }
  }
});

parseButtonEl.addEventListener("click", () => {
  try {
    const parsed = parseTsv(pasteInputEl.value);
    applyParsedData(parsed);
    setStatus(`已載入 ${parsed.students.length} 位學生資料。`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadSampleButtonEl.addEventListener("click", () => {
  pasteInputEl.value = sampleText;
  try {
    const parsed = parseTsv(sampleText);
    applyParsedData(parsed);
    setStatus("已載入範例資料。");
  } catch (error) {
    setStatus(error.message, true);
  }
});

studentTableBodyEl.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-index]");
  if (!row) {
    return;
  }
  const index = Number(row.dataset.index);
  selectStudent(index);
});

studentSelectEl.addEventListener("change", (event) => {
  const index = Number(event.target.value);
  if (Number.isFinite(index)) {
    selectStudent(index);
  }
});

downloadPdfButtonEl.addEventListener("click", exportAllStudentsPdf);

pasteInputEl.value = sampleText;
applyParsedData(parseTsv(sampleText));
