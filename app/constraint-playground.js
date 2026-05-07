// Constraint Playground — GUARD editor + FLUX-C bytecode visualizer
// Mock compiler: deterministic output based on source analysis

export function initPlayground(editorId, outputId) {
  const textarea = document.getElementById(editorId);
  const output = document.getElementById(outputId);
  const compileBtn = document.getElementById('compileBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (!textarea || !output) return;

  const EXAMPLES = {
    'Temperature': `GUARD temp_safety {
  INPUT temp: FLOAT
  THRESHOLD 100.0

  IF temp > THRESHOLD THEN
    ACT shutdown()
    LOG "CRITICAL: Temperature exceeded"
  ELSE IF temp > 80.0 THEN
    LOG "WARNING: Temperature rising"
  END
}`,
    'Door': `GUARD door_access {
  INPUT badge_id: STRING
  INPUT door_state: ENUM [closed, open, locked]

  IF door_state == locked AND badge_valid(badge_id) THEN
    ACT unlock_door()
    LOG "Access granted: " + badge_id
  END
}`,
    'Motor': `GUARD motor_protection {
  INPUT current: FLOAT
  INPUT rpm: INT

  IF current > 15.0 AND rpm < 100 THEN
    ACT cut_power()
    LOG "STALL DETECTED — power cut"
  ELSE IF current > 12.0 THEN
    ACT reduce_duty_cycle(50)
    LOG "Overcurrent warning — derating"
  END
}`,
    'Light': `GUARD light_control {
  INPUT lux: FLOAT

  IF lux < 50 THEN
    ACT lights_on()
    LOG "Dark — lights on"
  ELSE IF lux > 200 THEN
    ACT lights_off()
    LOG "Bright — lights off"
  END
}`
  };

  // Syntax highlight the code overlay
  function highlightCode(code) {
    let html = code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\/\/.*/g, '<span class="comment">$&</span>')
      .replace(/\b(GUARD|INPUT|THRESHOLD|IF|THEN|ELSE|END|ACT|LOG|AND|OR)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(FLOAT|INT|STRING|ENUM|BOOL)\b/g, '<span class="type">$1</span>')
      .replace(/"[^"]*"/g, '<span class="str">$&</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$&</span>');
    return html;
  }

  const highlightEl = document.getElementById('highlight');

  function updateHighlight() {
    if (highlightEl) {
      highlightEl.innerHTML = highlightCode(textarea.value);
    }
  }

  function syncScroll() {
    if (highlightEl) {
      highlightEl.scrollTop = textarea.scrollTop;
      highlightEl.scrollLeft = textarea.scrollLeft;
    }
  }

  textarea.addEventListener('input', updateHighlight);
  textarea.addEventListener('scroll', syncScroll);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      updateHighlight();
    }
  });

  // Mock FLUX-C compiler
  function mockCompile(source) {
    const lines = source.split('\n');
    const inputCount = (source.match(/\bINPUT\b/g) || []).length;
    const hasThreshold = /\bTHRESHOLD\b/.test(source);
    const ifCount = (source.match(/\bIF\b/g) || []).length;
    const elseCount = (source.match(/\bELSE\b/g) || []).length;
    const actCount = (source.match(/\bACT\b/g) || []).length;
    const logCount = (source.match(/\bLOG\b/g) || []).length;

    const bytecode = [];
    let addr = 0;

    // PROLOGUE
    bytecode.push({ addr, mnemonic: 'PROLOG', operand: '' });
    addr += 4;

    // INPUT loading
    if (inputCount >= 1) {
      bytecode.push({ addr, mnemonic: 'LOAD', operand: 'R1, [R0]' });
      addr += 4;
    }
    if (inputCount >= 2) {
      bytecode.push({ addr, mnemonic: 'LOAD', operand: 'R2, [R0+4]' });
      addr += 4;
    }
    if (inputCount >= 3) {
      bytecode.push({ addr, mnemonic: 'LOAD', operand: 'R3, [R0+8]' });
      addr += 4;
    }

    // THRESHOLD load
    if (hasThreshold) {
      bytecode.push({ addr, mnemonic: 'FLD', operand: 'F0, [THRESHOLD]' });
      addr += 4;
    }

    // IF branches
    const ifBranches = [];
    for (let i = 0; i < ifCount; i++) {
      bytecode.push({ addr, mnemonic: 'CMP', operand: 'R1, THRESHOLD' });
      addr += 4;
      const branchTarget = addr + (i < ifCount - 1 ? 12 : 8);
      bytecode.push({ addr, mnemonic: 'JGT', operand: '0x' + branchTarget.toString(16).padStart(4, '0') });
      addr += 4;
      ifBranches.push(addr);
      addr += 4;
    }

    // ACT calls
    for (let i = 0; i < actCount; i++) {
      const actions = ['shutdown()', 'unlock_door()', 'cut_power()', 'lights_on()', 'lights_off()', 'reduce_duty_cycle(50)'];
      bytecode.push({ addr, mnemonic: 'CALL', operand: actions[i % actions.length] });
      addr += 4;
    }

    // LOG calls
    for (let i = 0; i < logCount; i++) {
      bytecode.push({ addr, mnemonic: 'CALL', operand: 'log_info()' });
      addr += 4;
    }

    // EPILOGUE
    bytecode.push({ addr, mnemonic: 'HALT', operand: '0x00' });
    addr += 4;
    bytecode.push({ addr, mnemonic: 'NOP', operand: '' });

    const bytecodeSize = bytecode.length * 4;
    const safetyScore = Math.min(100, 60 + Math.floor(inputCount * 10 + actCount * 5));

    const guardName = source.match(/GUARD\s+(\w+)/)?.[1] || 'unknown';
    const preview = generatePreview(guardName, source);

    return {
      bytecode,
      metrics: {
        bytecodeSize,
        instructionCount: bytecode.length,
        safetyScore,
        compileMs: Math.floor(50 + Math.random() * 100),
        verifyMs: Math.floor(100 + Math.random() * 300)
      },
      preview,
      guardName
    };
  }

  function generatePreview(guardName, source) {
    if (guardName === 'temp_safety') {
      return [
        { input: 'temp=75°F', output: 'HALT ✓ safe', action: 'none' },
        { input: 'temp=88°F', output: 'HALT ✓ warning', action: 'log(WARNING)' },
        { input: 'temp=105°F', output: 'HALT ✓ critical', action: 'shutdown()' }
      ];
    }
    if (guardName === 'door_access') {
      return [
        { input: 'locked + valid', output: 'HALT ✓ granted', action: 'unlock_door()' },
        { input: 'locked + invalid', output: 'HALT ✓ denied', action: 'none' },
        { input: 'open + any', output: 'HALT ✓ ignored', action: 'none' }
      ];
    }
    if (guardName === 'motor_protection') {
      return [
        { input: 'current=8A, rpm=1200', output: 'HALT ✓ safe', action: 'none' },
        { input: 'current=13A, rpm=1500', output: 'HALT ✓ warning', action: 'reduce_duty_cycle(50)' },
        { input: 'current=18A, rpm=80', output: 'HALT ✓ stall', action: 'cut_power()' }
      ];
    }
    if (guardName === 'light_control') {
      return [
        { input: 'lux=30', output: 'HALT ✓ dark', action: 'lights_on()' },
        { input: 'lux=120', output: 'HALT ✓ nominal', action: 'none' },
        { input: 'lux=250', output: 'HALT ✓ bright', action: 'lights_off()' }
      ];
    }
    // Generic fallback
    return [
      { input: 'input=nominal', output: 'HALT ✓ OK', action: 'none' },
      { input: 'input=warning', output: 'HALT ✓ warning', action: 'log()' },
      { input: 'input=critical', output: 'HALT ✓ critical', action: 'ACT called' }
    ];
  }

  function renderBytecode(bytecode) {
    return bytecode.map(b => {
      const hexAddr = '0x' + b.addr.toString(16).padStart(4, '0').toUpperCase();
      return `<div class="asm-line">
        <span class="asm-addr">${hexAddr}</span>
        <span class="asm-mnemonic">${b.mnemonic.padEnd(6)}</span>
        <span class="asm-operand">${b.operand}</span>
      </div>`;
    }).join('');
  }

  function renderPreview(preview) {
    return preview.map(p => {
      const actionColor = p.action === 'none' ? 'var(--muted)' : 'var(--success)';
      return `<div class="exec-case">
        <span class="exec-input">${p.input}</span>
        <span class="exec-arrow">→</span>
        <span class="exec-result">${p.output}</span>
        ${p.action !== 'none' ? `<span class="exec-action" style="color:${actionColor}">[${p.action}]</span>` : ''}
      </div>`;
    }).join('');
  }

  function updateCursorPos() {
    const pos = textarea.selectionStart;
    const before = textarea.value.substring(0, pos);
    const lines = before.split('\n');
    const lineEl = document.getElementById('lineNum');
    const colEl = document.getElementById('colNum');
    if (lineEl) lineEl.textContent = lines.length;
    if (colEl) colEl.textContent = lines[lines.length - 1].length + 1;
  }

  textarea.addEventListener('click', updateCursorPos);
  textarea.addEventListener('keyup', updateCursorPos);

  function showCompiled(result) {
    output.innerHTML = `
      <div class="status-badge success">✓ Compiled — ${result.guardName}</div>
      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-value">${result.metrics.bytecodeSize}</div>
          <div class="metric-label">Bytecode Bytes</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${result.metrics.instructionCount}</div>
          <div class="metric-label">Instructions</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${result.metrics.safetyScore}</div>
          <div class="metric-label">Safety Score</div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-weight:600;margin-top:1rem;margin-bottom:0.5rem;color:var(--muted)">FLUX-C Bytecode</div>
      <div class="asm-output">${renderBytecode(result.bytecode)}</div>
      <div style="font-size:0.8rem;font-weight:600;margin-top:1rem;margin-bottom:0.5rem;color:var(--muted)">Execution Preview</div>
      <div class="exec-preview">${renderPreview(result.preview)}</div>
      <div style="font-size:0.75rem;color:var(--muted);margin-top:0.75rem;padding:0.5rem;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">
        ⚠️ Live FLUX-C compilation requires the fleet-coordinate WASM module (coming in Phase F)
      </div>
    `;
  }

  function showError(message) {
    output.innerHTML = `
      <div class="status-badge error">✗ Error — ${message}</div>
    `;
  }

  function showWaiting() {
    output.innerHTML = `
      <div class="status-badge loading">⏳ Waiting...</div>
    `;
  }

  compileBtn.addEventListener('click', () => {
    compileBtn.disabled = true;
    compileBtn.textContent = '⏳ Compiling...';
    showWaiting();
    setTimeout(() => {
      try {
        const result = mockCompile(textarea.value);
        showCompiled(result);
      } catch (e) {
        showError(e.message || 'Compilation failed');
      }
      compileBtn.disabled = false;
      compileBtn.textContent = '▶ Compile';
    }, 300 + Math.random() * 200);
  });

  resetBtn.addEventListener('click', () => {
    textarea.value = EXAMPLES['Temperature'];
    updateHighlight();
    showWaiting();
    setTimeout(() => {
      try {
        const result = mockCompile(textarea.value);
        showCompiled(result);
      } catch (e) {
        showError(e.message || 'Compilation failed');
      }
    }, 200);
  });

  // Load example on pill click
  document.querySelectorAll('.example-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const name = pill.dataset.example;
      if (EXAMPLES[name]) {
        textarea.value = EXAMPLES[name];
        updateHighlight();
        showWaiting();
        setTimeout(() => {
          try {
            const result = mockCompile(textarea.value);
            showCompiled(result);
          } catch (e) {
            showError(e.message || 'Compilation failed');
          }
        }, 200);
      }
    });
  });

  // Initial highlight
  updateHighlight();

  // Show initial compiled state
  setTimeout(() => {
    try {
      const result = mockCompile(textarea.value);
      showCompiled(result);
    } catch (e) {
      showError(e.message || 'Compilation failed');
    }
  }, 100);
}
