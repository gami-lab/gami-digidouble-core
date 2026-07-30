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
    .criteria { margin-top: 16px; padding-top: 14px; border-top: 1px solid #2c3850; }
    .criteria ul, .diagnostics ul { margin: 6px 0 0; padding-left: 20px; color: #c5d0e2; }
    .diagnostics { margin-top: 16px; padding: 14px; border-radius: 8px; background: #131a27; }
    .reason { line-height: 1.5; color: #dce4f2; }
    .metrics { margin-top: 14px; color: #9aa7bd; font-size: .85rem; }
    .error { margin-top: 14px; color: #ffabb0; white-space: pre-wrap; }
    .empty, .loading, .error-state { padding: 28px; text-align: center; color: #9aa7bd; }
    .error-state { color: #ffabb0; }
    @media (max-width: 680px) { header { display: block; } .toolbar { margin-top: 16px; } }
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
        const judgeText = judge ? 'Judge ' + judge.latencyMs + 'ms · ' + judge.totalTokens + ' tokens · ' + judge.model : 'Judge metrics unavailable';
        return avatarText + ' | ' + judgeText;
      };
      const costText = (cost) => cost === null || cost === undefined ? 'unavailable' : '$' + Number(cost).toFixed(6);
      const comparisonPanel = () => {
        if (!comparison) return null;
        const panel = el('section', 'panel');
        panel.append(el('h2', '', 'Model comparison'));
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        const header = document.createElement('tr');
        ['Model', 'Status', 'Passed', 'Partial', 'Failed', 'Pass rate', 'Estimated cost'].forEach((label) => {
          const cell = el('th', 'label', label);
          cell.style.textAlign = 'left';
          cell.style.padding = '8px 6px';
          header.append(cell);
        });
        table.append(header);
        comparison.runs.forEach((run) => {
          const row = document.createElement('tr');
          const summary = run.report.summary || {};
          const values = [
            run.model,
            run.report.status,
            value(summary.passed, 0),
            value(summary.partial, 0),
            value(summary.failed, 0),
            summary.passRate === null || summary.passRate === undefined ? 'n/a' : Math.round(summary.passRate * 100) + '%',
            costText(run.report.costEstimate && run.report.costEstimate.totalCostUsd),
          ];
          values.forEach((item) => {
            const cell = el('td', '', item);
            cell.style.padding = '8px 6px';
            cell.style.borderTop = '1px solid #2c3850';
            row.append(cell);
          });
          table.append(row);
        });
        panel.append(table);
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
      const render = () => {
        if (!report) return;
        app.replaceChildren();
        const header = el('header');
        const title = el('div');
        title.append(el('h1', '', report.testName || 'Conversation evaluation'));
        title.append(el('p', 'muted', 'Scenario ' + value(report.scenarioId) + ' · Last updated ' + value(report.finishedAt || report.startedAt)));
        header.append(title);
        const toolbar = el('div', 'toolbar');
        const refresh = el('button', '', 'Refresh now');
        refresh.addEventListener('click', load);
        if (comparison) {
          const modelSelect = document.createElement('select');
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
          toolbar.append(el('span', 'muted', 'Model:'), modelSelect);
        }
        const select = document.createElement('select');
        [['all', 'All questions'], ['passed', 'Passed'], ['partial', 'Partial'], ['failed', 'Failed'], ['api_error', 'API errors'], ['judge_error', 'Judge errors']].forEach(([key, label]) => {
          const option = el('option', '', label);
          option.value = key;
          option.selected = key === filter;
          select.append(option);
        });
        select.addEventListener('change', () => { filter = select.value; render(); });
        toolbar.append(refresh, select);
        header.append(toolbar);
        app.append(header);
        const summary = report.summary || {};
        const stats = el('div', 'grid');
        stats.append(stat('Questions', value(summary.questions, 0)), stat('Evaluated', value(summary.evaluated, 0)), stat('Passed', value(summary.passed, 0)), stat('Partial', value(summary.partial, 0)), stat('Failed', value(summary.failed, 0)), stat('Pass rate', summary.passRate === null || summary.passRate === undefined ? 'n/a' : Math.round(summary.passRate * 100) + '%'));
        app.append(stats);
        const comparisonView = comparisonPanel();
        if (comparisonView) app.append(comparisonView);
        const overview = el('section', 'panel');
        overview.append(el('h2', '', 'Run overview'));
        const meta = el('div', 'meta');
        [['Status', report.status], ['Avatar model', value(report.declaredModel)], ['Observed Avatar', (summary.observedAvatarModels || []).join(', ') || '—'], ['Judge model', value(report.declaredJudgeModel)], ['Observed judge', (summary.observedJudgeModels || []).join(', ') || '—'], ['Tokens', value(summary.totalTokens, 0) + ' Avatar · ' + value(summary.totalJudgeTokens, 0) + ' judge'], ['Estimated cost', costText(report.costEstimate && report.costEstimate.totalCostUsd)]].forEach(([label, content]) => {
          const item = el('span');
          item.append(el('b', '', label + ': '), el('span', '', content));
          meta.append(item);
        });
        overview.append(meta);
        if (report.error) overview.append(el('p', 'error', report.error.kind + ': ' + report.error.message));
        app.append(overview);
        const questions = (report.questions || []).filter((question) => filter === 'all' || question.status === filter);
        const panel = el('section', 'panel');
        panel.append(el('h2', '', 'Question details'));
        const questionList = el('div', 'question-list');
        if (!questions.length) questionList.append(el('div', 'empty', 'No questions match this filter.'));
        questions.forEach((question) => questionList.append(questionCard(question)));
        panel.append(questionList);
        app.append(panel);
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
      void load();
      window.setInterval(load, 2000);
    })();
  </script>
</body>
</html>`
