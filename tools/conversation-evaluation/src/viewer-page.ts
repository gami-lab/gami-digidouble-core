export const REPORT_VIEWER_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Conversation evaluation report</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #10131a; color: #e9edf5; }
    body { margin: 0; background: radial-gradient(circle at top right, #24304b 0, #10131a 45rem); min-height: 100vh; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 64px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); letter-spacing: -0.04em; }
    h2 { font-size: 1rem; margin-bottom: 12px; }
    h3 { font-size: 1rem; }
    .muted { color: #9aa7bd; }
    .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
    button, select { border: 1px solid #3d4b68; border-radius: 8px; background: #1a2232; color: #e9edf5; padding: 8px 12px; font: inherit; }
    button { cursor: pointer; }
    button:hover { background: #26344e; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .panel, .stat, .question { border: 1px solid #2c3850; border-radius: 12px; background: rgba(23, 29, 42, .9); box-shadow: 0 12px 32px rgba(0, 0, 0, .15); }
    .stat { padding: 16px; }
    .stat strong { display: block; font-size: 1.65rem; margin-top: 5px; }
    .stat span { color: #9aa7bd; font-size: .82rem; }
    .panel { padding: 18px; margin-bottom: 20px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 24px; color: #b6c1d4; font-size: .9rem; }
    .meta b { color: #e9edf5; }
    .question-list { display: grid; gap: 14px; }
    .question { padding: 18px; }
    .question-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 14px; }
    .badge { border-radius: 999px; padding: 4px 10px; font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .passed { color: #9df0bd; background: #123d2a; }
    .partial { color: #ffd58a; background: #4a3515; }
    .failed, .api_error, .judge_error { color: #ffabb0; background: #4b1f28; }
    .completed { color: #b5c4dc; background: #29354a; }
    .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .block { min-width: 0; }
    .label { color: #8e9ab0; font-size: .76rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 5px; }
    .answer { white-space: pre-wrap; line-height: 1.5; color: #dce4f2; }
    .sort-button { border: 0; background: transparent; color: inherit; padding: 0; font: inherit; font-weight: inherit; letter-spacing: inherit; text-transform: inherit; }
    .sort-button:hover { background: transparent; color: #fff; text-decoration: underline; }
    .print-sort-label { display: none; }
    .criteria { margin-top: 16px; padding-top: 14px; border-top: 1px solid #2c3850; }
    .criteria ul, .diagnostics ul { margin: 6px 0 0; padding-left: 20px; color: #c5d0e2; }
    .diagnostics { margin-top: 16px; padding: 14px; border-radius: 8px; background: #131a27; }
    .reason { line-height: 1.5; color: #dce4f2; }
    .metrics { margin-top: 14px; color: #9aa7bd; font-size: .85rem; }
    .error { margin-top: 14px; color: #ffabb0; white-space: pre-wrap; }
    .empty, .loading, .error-state { padding: 28px; text-align: center; color: #9aa7bd; }
    .error-state { color: #ffabb0; }
    @media (max-width: 680px) { header { display: block; } .toolbar { margin-top: 16px; } }
    @media print {
      @page { margin: 12mm; }
      :root { color-scheme: light; background: #fff; color: #111; }
      body { background: #fff; color: #111; }
      main { max-width: none; padding: 0; }
      .no-print { display: none !important; }
      .panel, .stat, .question { background: #fff; color: #111; box-shadow: none; border-color: #bbb; }
      .muted, .stat span, .metrics, .label { color: #444; }
      .answer, .reason { color: #111; }
      .diagnostics { background: #f2f2f2; }
      .model-print-section { break-before: page; }
      .model-print-section.first-model { break-before: auto; }
      .print-sort-label { display: inline; }
      .question, table { break-inside: avoid; }
      h1, h2, h3 { color: #111; }
    }
  </style>
</head>
<body>
  <main id="app"><div class="loading">Loading report…</div></main>
  <script>
    (() => {
      const app = document.getElementById('app');
      let report = null;
      let comparison = null;
      let selectedModel = '';
      let filter = 'all';
      let printMode = 'screen';
      let modelSortColumn = 1;
      let modelSortDirection = 1;
      const el = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = String(content);
        return node;
      };
      const value = (item, fallback = '—') => item === null || item === undefined || item === '' ? fallback : item;
      const list = (items) => {
        const node = el('ul');
        (items || []).forEach((item) => node.append(el('li', '', item)));
        return node;
      };
      const section = (label, content) => {
        const node = el('div', 'block');
        node.append(el('div', 'label', label), content);
        return node;
      };
      const stat = (label, content) => {
        const node = el('div', 'stat');
        node.append(el('span', '', label), el('strong', '', content));
        return node;
      };
      const metricText = (question) => {
        const avatar = question.metrics;
        const judge = question.judgeMetrics;
        const avatarText = avatar ? 'Avatar ' + avatar.latencyMs + 'ms · ' + avatar.totalTokens + ' tokens · ' + avatar.model : 'Avatar metrics unavailable';
        const judgeText = judge ? 'Judge ' + judge.latencyMs + 'ms · ' + judge.model : 'Judge metrics unavailable';
        return avatarText + ' | ' + judgeText;
      };
      const costText = (cost) => {
        if (cost === null || cost === undefined) return 'unavailable';
        const cents = Math.floor(Number(cost) * 10000) / 100;
        return cents.toFixed(2) + ' cents';
      };
      const avatarCost = (costEstimate) => costEstimate && costEstimate.avatar ? costEstimate.avatar.totalCostUsd : null;
      const runCost = (costEstimate) => costEstimate && ('gameMaster' in costEstimate || 'memory' in costEstimate)
        ? costEstimate.totalCostUsd
        : avatarCost(costEstimate);
      const runTokens = (summary) => value(summary.totalRunInputTokens, summary.totalInputTokens || 0) + ' / ' + value(summary.totalRunOutputTokens, summary.totalOutputTokens || 0);
      const providerOf = (model) => {
        const separator = String(model).indexOf('/');
        return separator > 0 ? String(model).slice(0, separator) : 'unknown';
      };
      const comparisonTable = (headers, rows, sortable = false) => {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        const header = document.createElement('tr');
        headers.forEach((label, columnIndex) => {
          const cell = el('th', 'label');
          cell.style.textAlign = 'left';
          cell.style.padding = '8px 6px';
          if (sortable) {
            const button = el('button', 'sort-button no-print', label);
            button.type = 'button';
            button.title = 'Sort by ' + label;
            button.addEventListener('click', () => {
              if (modelSortColumn === columnIndex) modelSortDirection *= -1;
              else {
                modelSortColumn = columnIndex;
                modelSortDirection = 1;
              }
              render();
            });
            if (modelSortColumn === columnIndex) {
              button.textContent = label + (modelSortDirection === 1 ? ' ↑' : ' ↓');
              cell.setAttribute('aria-sort', modelSortDirection === 1 ? 'ascending' : 'descending');
            }
            cell.append(button, el('span', 'print-sort-label', label));
          } else {
            cell.textContent = label;
          }
          header.append(cell);
        });
        table.append(header);
        const sortedRows = sortable
          ? [...rows].sort((left, right) => {
              const leftValue = left[modelSortColumn];
              const rightValue = right[modelSortColumn];
              if (typeof leftValue === 'number' && typeof rightValue === 'number') {
                return (leftValue - rightValue) * modelSortDirection;
              }
              return String(leftValue).localeCompare(String(rightValue), undefined, {
                numeric: true,
                sensitivity: 'base',
              }) * modelSortDirection;
            })
          : rows;
        sortedRows.forEach((values) => {
          const row = document.createElement('tr');
          values.forEach((item) => {
            const cell = el('td', '', item);
            cell.style.padding = '8px 6px';
            cell.style.borderTop = '1px solid #2c3850';
            row.append(cell);
          });
          table.append(row);
        });
        return table;
      };
      const comparisonPanel = () => {
        if (!comparison) return null;
        const panel = el('section', 'panel');
        const providerStats = new Map();
        comparison.runs.forEach((run) => {
          const provider = providerOf(run.model);
          const summary = run.report.summary || {};
          const existing = providerStats.get(provider) || { runs: 0, completed: 0, passed: 0, partial: 0, failed: 0, evaluated: 0, cost: 0, costKnown: true };
          existing.runs += 1;
          existing.completed += run.report.status === 'completed' ? 1 : 0;
          existing.passed += Number(summary.passed || 0);
          existing.partial += Number(summary.partial || 0);
          existing.failed += Number(summary.failed || 0);
          existing.evaluated += Number(summary.evaluated || 0);
          const cost = runCost(run.report.costEstimate);
          if (cost === null || cost === undefined) existing.costKnown = false;
          else existing.cost += Number(cost);
          providerStats.set(provider, existing);
        });
        const providerRows = [...providerStats.entries()].map(([provider, stats]) => [
          provider,
          stats.runs,
          stats.completed,
          stats.passed,
          stats.partial,
          stats.failed,
          stats.evaluated === 0 ? 'n/a' : Math.round(stats.passed / stats.evaluated * 100) + '%',
          stats.costKnown ? costText(stats.cost) : 'unavailable',
        ]);
        panel.append(el('h2', '', 'Provider comparison'));
        panel.append(comparisonTable(['Provider', 'Runs', 'Completed', 'Passed', 'Partial', 'Failed', 'Pass rate', 'Estimated cost'], providerRows));
        panel.append(el('h2', '', 'Model comparison'));
        const modelRows = comparison.runs.filter((run) => run.report.status === 'completed').map((run) => {
          const summary = run.report.summary || {};
          return [
            providerOf(run.model),
            run.model,
            value(summary.passed, 0),
            value(summary.partial, 0),
            value(summary.failed, 0),
            summary.passRate === null || summary.passRate === undefined ? 'n/a' : Math.round(summary.passRate * 100) + '%',
            runTokens(summary),
            costText(runCost(run.report.costEstimate)),
          ];
        });
        panel.append(comparisonTable(['Provider', 'Model', 'Passed', 'Partial', 'Failed', 'Pass rate', 'Tokens (send/receive)', 'Estimated cost'], modelRows, true));
        return panel;
      };
      const questionCard = (question) => {
        const card = el('article', 'question');
        const head = el('div', 'question-head');
        head.append(el('h3', '', 'Question ' + question.questionNumber));
        head.append(el('span', 'badge ' + question.status, question.status + (question.judge ? ' · score ' + question.judge.score : '')));
        card.append(head);
        const columns = el('div', 'columns');
        columns.append(section('Question', el('div', 'answer', question.question)));
        columns.append(section('Expected response', el('div', 'answer', question.expectedResponse)));
        columns.append(section('Actual response', el('div', 'answer', value(question.actualResponse))));
        card.append(columns);
        const hasCriteria = question.requiredFacts || question.acceptedAlternatives || question.forbiddenClaims;
        if (hasCriteria) {
          const criteria = el('div', 'criteria');
          criteria.append(el('div', 'label', 'Structured criteria'));
          const criteriaColumns = el('div', 'columns');
          if (question.requiredFacts) criteriaColumns.append(section('Required facts', list(question.requiredFacts)));
          if (question.acceptedAlternatives) criteriaColumns.append(section('Accepted alternatives', list(question.acceptedAlternatives)));
          if (question.forbiddenClaims) criteriaColumns.append(section('Forbidden claims', list(question.forbiddenClaims)));
          criteria.append(criteriaColumns);
          card.append(criteria);
        }
        if (question.judge) {
          const diagnostics = el('div', 'diagnostics');
          diagnostics.append(el('div', 'label', 'Judge diagnostics'));
          diagnostics.append(el('p', 'reason', question.judge.reason));
          const diagnosticColumns = el('div', 'columns');
          if (question.judge.missingElements.length) diagnosticColumns.append(section('Missing elements', list(question.judge.missingElements)));
          if (question.judge.contradictions.length) diagnosticColumns.append(section('Contradictions', list(question.judge.contradictions)));
          if (diagnosticColumns.childElementCount) diagnostics.append(diagnosticColumns);
          card.append(diagnostics);
        }
        if (question.error) card.append(el('p', 'error', question.error.kind + ': ' + question.error.message));
        card.append(el('div', 'metrics', metricText(question)));
        return card;
      };
      const renderRunDetails = (runReport, model, printable, firstModel) => {
        const container = el('div', printable ? 'model-print-section' + (firstModel ? ' first-model' : '') : '');
        if (printable) container.append(el('h2', '', 'Model: ' + model));
        const summary = runReport.summary || {};
        const stats = el('div', 'grid');
        stats.append(stat('Questions', value(summary.questions, 0)), stat('Evaluated', value(summary.evaluated, 0)), stat('Passed', value(summary.passed, 0)), stat('Partial', value(summary.partial, 0)), stat('Failed', value(summary.failed, 0)), stat('Pass rate', summary.passRate === null || summary.passRate === undefined ? 'n/a' : Math.round(summary.passRate * 100) + '%'));
        container.append(stats);
        const overview = el('section', 'panel');
        overview.append(el('h2', '', 'Run overview'));
        const meta = el('div', 'meta');
        const runtimeStatus = value(summary.runtimeUsageStatus, 'unknown');
        const usageText = 'Total ' + value(summary.totalRunTokens, summary.totalTokens || 0) + ' · Avatar ' + value(summary.totalTokens, 0) + ' · Game Master ' + value(summary.gameMasterUsage && summary.gameMasterUsage.totalTokens, 0) + ' · Memory ' + value(summary.memoryUsage && summary.memoryUsage.totalTokens, 0);
        [['Status', runReport.status], ['Avatar model', value(runReport.declaredModel)], ['Observed Avatar', (summary.observedAvatarModels || []).join(', ') || '—'], ['Judge model', value(runReport.declaredJudgeModel)], ['Observed judge', (summary.observedJudgeModels || []).join(', ') || '—'], ['Tokens', usageText], ['Runtime usage', runtimeStatus], ['Estimated cost', costText(runCost(runReport.costEstimate))]].forEach(([label, content]) => {
          const item = el('span');
          item.append(el('b', '', label + ': '), el('span', '', content));
          meta.append(item);
        });
        overview.append(meta);
        if (runReport.error) overview.append(el('p', 'error', runReport.error.kind + ': ' + runReport.error.message));
        container.append(overview);
        const questions = (runReport.questions || []).filter((question) => printable || filter === 'all' || question.status === filter);
        const panel = el('section', 'panel');
        panel.append(el('h2', '', 'Question details'));
        const questionList = el('div', 'question-list');
        if (!questions.length) questionList.append(el('div', 'empty', 'No questions match this filter.'));
        questions.forEach((question) => questionList.append(questionCard(question)));
        panel.append(questionList);
        container.append(panel);
        return container;
      };
      const render = () => {
        if (!report) return;
        app.replaceChildren();
        const header = el('header');
        const title = el('div');
        title.append(el('h1', '', report.testName || 'Conversation evaluation'));
        title.append(el('p', 'muted', 'Scenario ' + value(report.scenarioId) + ' · Last updated ' + value(report.finishedAt || report.startedAt)));
        header.append(title);
        const toolbar = el('div', 'toolbar');
        const refresh = el('button', 'no-print', 'Refresh now');
        refresh.addEventListener('click', load);
        if (comparison) {
          const modelSelect = document.createElement('select');
          modelSelect.className = 'no-print';
          comparison.runs.forEach((run) => {
            const option = el('option', '', run.model);
            option.value = run.model;
            option.selected = run.model === selectedModel;
            modelSelect.append(option);
          });
          modelSelect.addEventListener('change', () => {
            selectedModel = modelSelect.value;
            const selected = comparison.runs.find((run) => run.model === selectedModel);
            if (selected) report = selected.report;
            render();
          });
          toolbar.append(el('span', 'muted no-print', 'Model:'), modelSelect);
        }
        const select = document.createElement('select');
        select.className = 'no-print';
        [['all', 'All questions'], ['passed', 'Passed'], ['partial', 'Partial'], ['failed', 'Failed'], ['api_error', 'API errors'], ['judge_error', 'Judge errors']].forEach(([key, label]) => {
          const option = el('option', '', label);
          option.value = key;
          option.selected = key === filter;
          select.append(option);
        });
        select.addEventListener('change', () => { filter = select.value; render(); });
        const printCurrent = el('button', 'no-print', 'Print current model');
        printCurrent.addEventListener('click', () => {
          printMode = 'current';
          render();
          window.setTimeout(() => window.print(), 0);
        });
        toolbar.append(refresh, select, printCurrent);
        if (comparison) {
          const printModels = el('button', 'no-print', 'Print all models');
          printModels.addEventListener('click', () => {
            printMode = 'all';
            render();
            window.setTimeout(() => window.print(), 0);
          });
          toolbar.append(printModels);
        }
        header.append(toolbar);
        app.append(header);
        const comparisonView = comparisonPanel();
        if (comparisonView) app.append(comparisonView);
        if (printMode === 'all' && comparison) {
          comparison.runs.forEach((run, index) => app.append(renderRunDetails(run.report, run.model, true, index === 0)));
        } else {
          app.append(renderRunDetails(report, selectedModel || report.declaredModel || 'current model', printMode === 'current', true));
        }
      };
      async function load() {
        try {
          const response = await fetch('/report.json?ts=' + Date.now(), { cache: 'no-store' });
          if (!response.ok) throw new Error('Report request failed with HTTP ' + response.status);
          const payload = await response.json();
          if (payload && payload.reportType === 'model_comparison') {
            comparison = payload;
            if (!comparison.runs.length) {
              report = null;
            } else {
              const selected = comparison.runs.find((run) => run.model === selectedModel) || comparison.runs[0];
              selectedModel = selected.model;
              report = selected.report;
            }
          } else {
            comparison = null;
            report = payload;
          }
          render();
        } catch (error) {
          app.replaceChildren(el('div', 'error-state', error instanceof Error ? error.message : 'Unable to load report.'));
        }
      }
      window.addEventListener('afterprint', () => {
        if (printMode !== 'screen') {
          printMode = 'screen';
          render();
        }
      });
      void load();
      window.setInterval(load, 2000);
    })();
  </script>
</body>
</html>`
