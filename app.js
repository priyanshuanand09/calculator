/**
 * OmniCalc - Comprehensive Modern Calculator
 * Features: Standard & Scientific Math Engine, History Tape, Keyboard shortcuts,
 * Web Audio FX, Dynamic Display Scaling, Light/Dark Theme, Memory Functions.
 */

(function () {
  'use strict';

  // --- State Variables ---
  let expression = '';
  let lastResult = null;
  let isEvaluated = false;
  let angleUnit = 'DEG'; // 'DEG' or 'RAD'
  let isSecondMode = false;
  let memoryValue = 0;
  let soundEnabled = true;
  let historyData = [];

  // --- Web Audio Synthesizer ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      switch (type) {
        case 'num':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(540, now);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        case 'op':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(720, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        case 'equals':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(580, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.start(now);
          osc.stop(now + 0.14);
          break;
        case 'clear':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
          break;
      }
    } catch {
      // Audio context might fail if unprompted, ignore gracefully
    }
  }

  // --- DOM Elements ---
  const resultDisplay = document.getElementById('resultDisplay');
  const expressionDisplay = document.getElementById('expressionDisplay');
  const angleToggleBtn = document.getElementById('angleToggleBtn');
  const memoryIndicator = document.getElementById('memoryIndicator');
  const modeToggleBtn = document.getElementById('modeToggleBtn');
  const calculatorWrapper = document.querySelector('.calculator-wrapper');
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const historyBadge = document.getElementById('historyBadge');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = document.querySelector('.icon-sound-on');
  const soundOffIcon = document.querySelector('.icon-sound-off');
  const copyResultBtn = document.getElementById('copyResultBtn');
  const copyToast = document.getElementById('copyToast');
  const keyClear = document.getElementById('keyClear');

  // --- Display Updates ---
  function updateDisplay() {
    // Format expression for readability with clear spacing
    let prettyExp = expression
      .replace(/\^/g, ' ^ ')
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/-/g, ' − ')
      .replace(/\+/g, ' + ');

    expressionDisplay.textContent = prettyExp;

    // Adjust font size based on result length
    const resText = resultDisplay.textContent;
    resultDisplay.classList.remove('small-font', 'xsmall-font');
    if (resText.length > 14) {
      resultDisplay.classList.add('xsmall-font');
    } else if (resText.length > 9) {
      resultDisplay.classList.add('small-font');
    }

    // Toggle AC vs C text
    if (expression.length > 0 || isEvaluated) {
      keyClear.textContent = 'C';
    } else {
      keyClear.textContent = 'AC';
    }
  }

  function setResult(value, isError = false) {
    if (isError) {
      resultDisplay.textContent = value;
      playSound('error');
    } else {
      resultDisplay.textContent = formatNumber(value);
    }
    updateDisplay();
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return num;
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return num > 0 ? 'Cannot divide by 0' : '-Infinity';

    // Fix floating point inaccuracies e.g. 0.1 + 0.2 = 0.30000000000000004
    const rounded = Number(num.toPrecision(12));

    // Handle extremely large or small numbers with scientific notation
    if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-7)) {
      return rounded.toExponential(6);
    }

    // Strip trailing decimal zeros
    const str = rounded.toString();
    if (str.includes('.')) {
      return str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    }
    return str;
  }

  function getCurrentToken() {
    const tokens = expression.split(/([+\-*/()^])/);
    return tokens[tokens.length - 1];
  }

  // --- User Inputs ---
  function inputDigit(digit) {
    playSound('num');
    if (isEvaluated) {
      expression = '';
      isEvaluated = false;
    }

    // Avoid multiple zero prefixes
    const currentToken = getCurrentToken();
    if (currentToken === '0' && digit === '0') return;
    if (currentToken === '0' && digit !== '0') {
      expression = expression.slice(0, -1) + digit;
    } else {
      expression += digit;
    }

    resultDisplay.textContent = getCurrentToken() || digit;
    updateDisplay();
  }

  function inputDecimal() {
    playSound('num');
    if (isEvaluated) {
      expression = '0';
      isEvaluated = false;
    }

    const currentToken = getCurrentToken();
    if (!currentToken) {
      expression += '0.';
    } else if (!currentToken.includes('.')) {
      expression += '.';
    }
    resultDisplay.textContent = getCurrentToken() || '0.';
    updateDisplay();
  }

  function inputOperator(op) {
    playSound('op');
    if (isEvaluated) {
      if (lastResult !== null && !isNaN(lastResult) && isFinite(lastResult)) {
        expression = String(lastResult);
      } else {
        expression = '0';
      }
      isEvaluated = false;
    }

    if (expression === '' && op === '-') {
      expression = '-';
      resultDisplay.textContent = '-';
      updateDisplay();
      return;
    }

    if (expression === '') return;

    // Replace operator if preceding character is already an operator
    const lastChar = expression.slice(-1);
    if (['+', '-', '*', '/'].includes(lastChar)) {
      expression = expression.slice(0, -1) + op;
    } else {
      expression += op;
    }
    updateDisplay();
  }

  function inputChar(char) {
    playSound('num');
    if (isEvaluated) {
      expression = '';
      isEvaluated = false;
    }
    expression += char;
    updateDisplay();
  }

  function backspace() {
    playSound('clear');
    if (isEvaluated) {
      clearAll();
      return;
    }
    if (expression.length > 0) {
      // Remove trailing multi-char functions if present like 'sin(' or 'Math.PI'
      const funcMatch = expression.match(/(sin|cos|tan|asin|acos|atan|ln|log|sqrt|cbrt|abs)\($/);
      if (funcMatch) {
        expression = expression.slice(0, -funcMatch[0].length);
      } else {
        expression = expression.slice(0, -1);
      }
      const curr = getCurrentToken();
      resultDisplay.textContent = curr ? curr : (expression ? '' : '0');
      updateDisplay();
    }
  }

  function clearAll() {
    playSound('clear');
    expression = '';
    lastResult = null;
    isEvaluated = false;
    resultDisplay.textContent = '0';
    updateDisplay();
  }

  function toggleNegate() {
    playSound('op');
    if (isEvaluated && lastResult !== null && isFinite(lastResult)) {
      expression = String(-lastResult);
      isEvaluated = false;
      resultDisplay.textContent = expression;
      updateDisplay();
      return;
    }

    const token = getCurrentToken();
    if (!token) return;

    const baseExp = expression.slice(0, expression.length - token.length);
    if (token.startsWith('(-') && token.endsWith(')')) {
      expression = baseExp + token.slice(2, -1);
    } else if (token.startsWith('-')) {
      expression = baseExp + token.substring(1);
    } else {
      expression = baseExp + `(-${token})`;
    }
    updateDisplay();
  }

  function inputPercent() {
    playSound('op');
    try {
      if (expression === '') return;
      const val = evaluateMath(expression);
      const percentVal = val / 100;
      const formatted = formatNumber(percentVal);
      addHistory(expression + ' %', formatted);
      expression = String(percentVal);
      setResult(percentVal);
      isEvaluated = true;
    } catch {
      setResult('Error', true);
    }
  }

  // --- Scientific Engine ---
  function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity;
    if (!Number.isInteger(n)) return gamma(n + 1);
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  function gamma(z) {
    const p = [
      676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
    const t = z + p.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function applyScientificFunc(func) {
    playSound('op');
    if (isEvaluated && lastResult !== null && isFinite(lastResult)) {
      expression = String(lastResult);
      isEvaluated = false;
    }

    if (func === '2nd') {
      toggleSecondMode();
      return;
    }

    if (func === 'pi') {
      const lastChar = expression.slice(-1);
      if (lastChar && !['+', '-', '*', '/', '(', '^'].includes(lastChar)) {
        expression += '*π';
      } else {
        expression += 'π';
      }
      updateDisplay();
      return;
    }

    if (func === 'e') {
      const lastChar = expression.slice(-1);
      if (lastChar && !['+', '-', '*', '/', '(', '^'].includes(lastChar)) {
        expression += '*e';
      } else {
        expression += 'e';
      }
      updateDisplay();
      return;
    }

    if (func === 'pow') {
      expression += '^';
      updateDisplay();
      return;
    }

    // Unary functions opening a paren
    if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'sqrt', 'cbrt', 'abs'].includes(func)) {
      const lastChar = expression.slice(-1);
      if (lastChar && !['+', '-', '*', '/', '(', '^'].includes(lastChar)) {
        expression += `*${func}(`;
      } else {
        expression += `${func}(`;
      }
      updateDisplay();
      return;
    }

    // Direct instantaneous operations on current expression/value
    try {
      let currentVal = expression ? evaluateMath(expression) : 0;
      let calculated = 0;

      switch (func) {
        case 'sqr':
          calculated = Math.pow(currentVal, 2);
          break;
        case 'inv':
          if (currentVal === 0) throw new Error('Divide by zero');
          calculated = 1 / currentVal;
          break;
        case 'fact':
          calculated = factorial(currentVal);
          break;
        case 'exp':
          calculated = Math.exp(currentVal);
          break;
        case 'pow10':
          calculated = Math.pow(10, currentVal);
          break;
        default:
          return;
      }

      const formatted = formatNumber(calculated);
      addHistory(`${func}(${expression})`, formatted);
      expression = String(calculated);
      setResult(calculated);
      isEvaluated = true;
    } catch (err) {
      setResult(err.message === 'Divide by zero' ? 'Cannot divide by 0' : 'Error', true);
    }
  }

  function toggleSecondMode() {
    isSecondMode = !isSecondMode;
    const btn2nd = document.querySelector('[data-func="2nd"]');
    if (btn2nd) btn2nd.classList.toggle('active-2nd', isSecondMode);

    const sinBtn = document.querySelector('[data-func="sin"], [data-func="asin"]');
    const cosBtn = document.querySelector('[data-func="cos"], [data-func="acos"]');
    const tanBtn = document.querySelector('[data-func="tan"], [data-func="atan"]');
    const lnBtn = document.querySelector('[data-func="ln"], [data-func="exp"]');
    const logBtn = document.querySelector('[data-func="log"], [data-func="pow10"]');

    if (isSecondMode) {
      if (sinBtn) { sinBtn.textContent = 'sin⁻¹'; sinBtn.setAttribute('data-func', 'asin'); }
      if (cosBtn) { cosBtn.textContent = 'cos⁻¹'; cosBtn.setAttribute('data-func', 'acos'); }
      if (tanBtn) { tanBtn.textContent = 'tan⁻¹'; tanBtn.setAttribute('data-func', 'atan'); }
      if (lnBtn) { lnBtn.textContent = 'eˣ'; lnBtn.setAttribute('data-func', 'exp'); }
      if (logBtn) { logBtn.textContent = '10ˣ'; logBtn.setAttribute('data-func', 'pow10'); }
    } else {
      if (sinBtn) { sinBtn.textContent = 'sin'; sinBtn.setAttribute('data-func', 'sin'); }
      if (cosBtn) { cosBtn.textContent = 'cos'; cosBtn.setAttribute('data-func', 'cos'); }
      if (tanBtn) { tanBtn.textContent = 'tan'; tanBtn.setAttribute('data-func', 'tan'); }
      if (lnBtn) { lnBtn.textContent = 'ln'; lnBtn.setAttribute('data-func', 'ln'); }
      if (logBtn) { logBtn.textContent = 'log'; logBtn.setAttribute('data-func', 'log'); }
    }
  }

  // --- Evaluation Logic ---
  function evaluateMath(rawExp) {
    if (!rawExp || rawExp.trim() === '') return 0;

    let exp = rawExp
      .replace(/÷/g, '/')
      .replace(/×/g, '*')
      .replace(/−/g, '-');

    // Handle implicit multiplication like 5(2), (3)(4), 5sin(30), 5π, 5e
    exp = exp.replace(/(\d)\s*\(/g, '$1*(');
    exp = exp.replace(/\)\s*(\d)/g, ')*$1');
    exp = exp.replace(/\)\s*\(/g, ')*(');
    exp = exp.replace(/(\d)\s*(π|e|[a-zA-Z])/g, '$1*$2');
    exp = exp.replace(/(π|e)\s*(\d)/g, '$1*$2');

    // Convert power symbol
    exp = exp.replace(/\^/g, '**');

    // Replace mathematical constants
    exp = exp.replace(/π/g, '(Math.PI)');
    exp = exp.replace(/(?<![a-zA-Z0-9])e(?![a-zA-Z0-9])/g, '(Math.E)');

    // Auto-close missing parentheses
    const openParens = (exp.match(/\(/g) || []).length;
    const closeParens = (exp.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      exp += ')'.repeat(openParens - closeParens);
    }

    const isDeg = angleUnit === 'DEG';
    const toRad = deg => (deg * Math.PI) / 180;
    const toDeg = rad => (rad * 180) / Math.PI;

    const mathScope = {
      sin: x => Math.sin(isDeg ? toRad(x) : x),
      cos: x => {
        if (isDeg && Math.abs(x % 180) === 90) return 0;
        return Math.cos(isDeg ? toRad(x) : x);
      },
      tan: x => {
        if (isDeg && Math.abs(x % 180) === 90) throw new Error('Undefined');
        return Math.tan(isDeg ? toRad(x) : x);
      },
      asin: x => (isDeg ? toDeg(Math.asin(x)) : Math.asin(x)),
      acos: x => (isDeg ? toDeg(Math.acos(x)) : Math.acos(x)),
      atan: x => (isDeg ? toDeg(Math.atan(x)) : Math.atan(x)),
      ln: x => Math.log(x),
      log: x => Math.log10(x),
      sqrt: x => Math.sqrt(x),
      cbrt: x => Math.cbrt(x),
      abs: x => Math.abs(x),
      Math: Math
    };

    // Sanitize string to prevent arbitrary code execution
    const testSanitized = exp.replace(/(sin|cos|tan|asin|acos|atan|ln|log|sqrt|cbrt|abs|Math\.PI|Math\.E)/g, '');
    if (!/^[0-9+\-*/()., eE*]+$/.test(testSanitized)) {
      throw new Error('Invalid syntax');
    }

    const scopeKeys = Object.keys(mathScope);
    const scopeValues = Object.values(mathScope);
    const evaluator = new Function(...scopeKeys, `"use strict"; return (${exp});`);
    const result = evaluator(...scopeValues);

    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error('Computation Error');
    }
    if (!isFinite(result)) {
      throw new Error('Divide by zero');
    }

    return result;
  }

  function calculateResult() {
    if (expression === '') return;
    playSound('equals');

    try {
      const result = evaluateMath(expression);
      const formatted = formatNumber(result);
      const originalExpression = expression;

      addHistory(originalExpression, formatted);
      setResult(result);
      lastResult = result;
      isEvaluated = true;
    } catch (err) {
      setResult(err.message === 'Divide by zero' ? 'Cannot divide by 0' : 'Error', true);
      isEvaluated = true;
    }
  }

  // --- Memory Operations ---
  function handleMemory(action) {
    playSound('op');
    let currentVal = lastResult !== null ? lastResult : (expression ? evaluateMath(expression) : 0);

    switch (action) {
      case 'mem-clear':
        memoryValue = 0;
        memoryIndicator.classList.add('hidden');
        break;
      case 'mem-recall':
        if (memoryValue !== 0) {
          if (isEvaluated) expression = '';
          expression += String(memoryValue);
          setResult(memoryValue);
          isEvaluated = false;
        }
        break;
      case 'mem-add':
        memoryValue += currentVal;
        memoryIndicator.classList.remove('hidden');
        break;
      case 'mem-sub':
        memoryValue -= currentVal;
        memoryIndicator.classList.remove('hidden');
        break;
      case 'mem-store':
        memoryValue = currentVal;
        if (memoryValue !== 0) {
          memoryIndicator.classList.remove('hidden');
        } else {
          memoryIndicator.classList.add('hidden');
        }
        break;
    }
  }

  // --- History Tape Manager ---
  function addHistory(exp, res) {
    const entry = {
      id: Date.now(),
      expression: exp,
      result: res,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    historyData.unshift(entry);
    if (historyData.length > 50) historyData.pop();
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (historyData.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 8v4l3 3"></path>
            <circle cx="12" cy="12" r="9"></circle>
          </svg>
          <p>No calculation history yet</p>
          <small>Calculations will appear here</small>
        </div>`;
      historyBadge.classList.add('hidden');
      return;
    }

    historyBadge.textContent = historyData.length;
    historyBadge.classList.remove('hidden');

    historyList.innerHTML = '';
    historyData.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <span class="history-item-time">${item.time}</span>
        <span class="history-item-exp">${item.expression} =</span>
        <span class="history-item-res">${item.result}</span>
      `;
      el.addEventListener('click', () => {
        expression = String(item.result);
        setResult(item.result);
        isEvaluated = false;
        closeHistoryDrawer();
        playSound('num');
      });
      historyList.appendChild(el);
    });
  }

  function saveHistory() {
    try {
      localStorage.setItem('omnicalc_history', JSON.stringify(historyData));
    } catch {}
  }

  function loadHistory() {
    try {
      const saved = localStorage.getItem('omnicalc_history');
      if (saved) {
        historyData = JSON.parse(saved);
        renderHistory();
      }
    } catch {}
  }

  function clearHistory() {
    playSound('clear');
    historyData = [];
    saveHistory();
    renderHistory();
  }

  function toggleHistoryDrawer() {
    historyDrawer.classList.toggle('open');
  }

  function closeHistoryDrawer() {
    historyDrawer.classList.remove('open');
  }

  // --- Themes & Settings ---
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);

    if (newTheme === 'light') {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }

    try {
      localStorage.setItem('omnicalc_theme', newTheme);
    } catch {}
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    soundOnIcon.classList.toggle('hidden', !soundEnabled);
    soundOffIcon.classList.toggle('hidden', soundEnabled);
    try {
      localStorage.setItem('omnicalc_sound', String(soundEnabled));
    } catch {}
    if (soundEnabled) playSound('num');
  }

  function toggleScientificMode() {
    playSound('op');
    const isSciActive = calculatorWrapper.classList.toggle('scientific-mode-active');
    modeToggleBtn.classList.toggle('active', isSciActive);
    try {
      localStorage.setItem('omnicalc_sci_mode', String(isSciActive));
    } catch {}
  }

  function toggleAngleMode() {
    playSound('op');
    angleUnit = angleUnit === 'DEG' ? 'RAD' : 'DEG';
    angleToggleBtn.textContent = angleUnit;
    try {
      localStorage.setItem('omnicalc_angle', angleUnit);
    } catch {}
  }

  function loadSettings() {
    try {
      const savedTheme = localStorage.getItem('omnicalc_theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'light') {
          sunIcon.classList.remove('hidden');
          moonIcon.classList.add('hidden');
        }
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }

      const savedSound = localStorage.getItem('omnicalc_sound');
      if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
        soundOnIcon.classList.toggle('hidden', !soundEnabled);
        soundOffIcon.classList.toggle('hidden', soundEnabled);
      }

      const savedSci = localStorage.getItem('omnicalc_sci_mode');
      if (savedSci === 'true') {
        calculatorWrapper.classList.add('scientific-mode-active');
        modeToggleBtn.classList.add('active');
      }

      const savedAngle = localStorage.getItem('omnicalc_angle');
      if (savedAngle) {
        angleUnit = savedAngle;
        angleToggleBtn.textContent = angleUnit;
      }
    } catch {}
  }

  // --- Copy Result ---
  function copyResult() {
    const text = resultDisplay.textContent;
    if (!text || text === 'Error' || text === 'Cannot divide by 0') return;

    playSound('num');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopyToast).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }

    function showCopyToast() {
      copyToast.classList.add('show');
      setTimeout(() => copyToast.classList.remove('show'), 1600);
    }

    function fallbackCopy() {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyToast();
    }
  }

  // --- Event Bindings ---
  function attachEventListeners() {
    modeToggleBtn.addEventListener('click', toggleScientificMode);
    angleToggleBtn.addEventListener('click', toggleAngleMode);
    themeToggleBtn.addEventListener('click', toggleTheme);
    soundToggleBtn.addEventListener('click', toggleSound);

    historyToggleBtn.addEventListener('click', toggleHistoryDrawer);
    closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
    clearHistoryBtn.addEventListener('click', clearHistory);

    copyResultBtn.addEventListener('click', copyResult);

    // Memory bar
    document.querySelector('.memory-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('.mem-btn');
      if (btn && btn.dataset.action) {
        handleMemory(btn.dataset.action);
      }
    });

    // Keypad clicks
    document.getElementById('keypadContainer').addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (!key) return;

      key.classList.add('key-active');
      setTimeout(() => key.classList.remove('key-active'), 120);

      if (key.dataset.number !== undefined) {
        inputDigit(key.dataset.number);
      } else if (key.dataset.operator !== undefined) {
        inputOperator(key.dataset.operator);
      } else if (key.dataset.char !== undefined) {
        if (key.dataset.char === '.') {
          inputDecimal();
        } else {
          inputChar(key.dataset.char);
        }
      } else if (key.dataset.func !== undefined) {
        applyScientificFunc(key.dataset.func);
      } else if (key.dataset.action !== undefined) {
        switch (key.dataset.action) {
          case 'clear':
            clearAll();
            break;
          case 'backspace':
            backspace();
            break;
          case 'equals':
            calculateResult();
            break;
          case 'negate':
            toggleNegate();
            break;
          case 'percent':
            inputPercent();
            break;
        }
      }
    });

    // Physical Keyboard
    window.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      toggleScientificMode();
      return;
    }
    if (e.altKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      toggleHistoryDrawer();
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
      highlightKey(`[data-number="${e.key}"]`);
    } else if (e.key === '.') {
      inputDecimal();
      highlightKey('[data-char="."]');
    } else if (['+', '-', '*', '/'].includes(e.key)) {
      e.preventDefault();
      inputOperator(e.key);
      highlightKey(`[data-operator="${e.key}"]`);
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      calculateResult();
      highlightKey('[data-action="equals"]');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      backspace();
      highlightKey('[data-action="backspace"]');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearAll();
      highlightKey('#keyClear');
    } else if (e.key === '(' || e.key === ')') {
      inputChar(e.key);
      highlightKey(`[data-char="${e.key}"]`);
    } else if (e.key === '%') {
      inputPercent();
      highlightKey('[data-action="percent"]');
    } else if (e.key === '^') {
      e.preventDefault();
      applyScientificFunc('pow');
    }
  }

  function highlightKey(selector) {
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add('key-active');
      setTimeout(() => el.classList.remove('key-active'), 120);
    }
  }

  // --- Bootstrapping ---
  function init() {
    loadSettings();
    loadHistory();
    attachEventListeners();
    updateDisplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
