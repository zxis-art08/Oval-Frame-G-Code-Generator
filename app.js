/**
 * App Controller — Wires UI to generator and renderer
 */

(function() {
  const generator = new GCodeGenerator();
  const canvas = document.getElementById('previewCanvas');
  const renderer = new PreviewRenderer(canvas);

  let currentView = 'top';
  let lastResult = { frame: null, template: null };
  let currentGcodeTab = 'frame'; // 'frame' or 'template'

  // ========== Config Gathering ==========
  function getConfig() {
    return {
      ovalWidth:         parseFloat(document.getElementById('ovalWidth').value) || 300,
      ovalHeight:        parseFloat(document.getElementById('ovalHeight').value) || 400,
      frameWidth:        parseFloat(document.getElementById('frameWidth').value) || 20,
      rabbetWidth:       parseFloat(document.getElementById('rabbetWidth').value) || 5,
      rabbitDepth:       parseFloat(document.getElementById('rabbitDepth').value) || 10,
      materialThickness: parseFloat(document.getElementById('materialThickness').value) || 15,
      woodType:          document.getElementById('woodType').value,
      toolDiameter:      parseFloat(document.getElementById('toolDiameter').value) || 6,
      toolFlutes:        parseInt(document.getElementById('toolFlutes').value) || 2,
      cncModel:          document.getElementById('cncModel').value,
      tabCount:          parseInt(document.getElementById('tabCount').value) || 4,
      tabWidth:          parseFloat(document.getElementById('tabWidth').value) || 6,
      tabHeight:         parseFloat(document.getElementById('tabHeight').value) || 2,
      finishAllowance:   parseFloat(document.getElementById('finishAllowance').value) || 0.3,
      cutDirection:      document.getElementById('cutDirection').value,
      originPosition:    document.getElementById('originPosition').value,
      enableRabbit:      document.getElementById('enableRabbit').checked,
      enableFinishPass:  document.getElementById('enableFinishPass').checked
    };
  }

  // ========== Update Calculated Params Display ==========
  function updateCalcDisplay() {
    const config = getConfig();
    const params = generator.calculateParams(config);
    
    document.getElementById('calcRPM').textContent = params.rpm.toLocaleString();
    document.getElementById('calcFeed').textContent = `${params.feedRate.toLocaleString()} mm/min`;
    document.getElementById('calcDOC').textContent = `${params.doc} mm`;
    document.getElementById('calcPlunge').textContent = `${params.plungeRate.toLocaleString()} mm/min`;
    document.getElementById('calcStepover').textContent = `${params.stepover} mm (${Math.round(params.stepover / config.toolDiameter * 100)}%)`;
    document.getElementById('calcSafeZ').textContent = `${params.safeZ} mm`;

    // Machine info
    const spec = params.spec;
    document.getElementById('machineInfo').textContent = 
      `작업 영역: ${spec.workArea[0]}×${spec.workArea[1]}mm / 최대 RPM: ${spec.maxRPM.toLocaleString()} / 최대 이송: ${spec.maxFeed.toLocaleString()} mm/min`;

    // Update preview (use active result for toolpath view)
    const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    renderer.render(config, currentView, activeResult);
  }

  // ========== Section Toggle ==========
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-toggle');
      if (!targetId) return;
      const content = document.getElementById(targetId);
      if (content) {
        content.classList.toggle('collapsed');
        header.querySelector('.chevron')?.classList.toggle('rotated');
      }
    });
  });

  // ========== Preview Tabs ==========
  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view');
      const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
      renderer.render(getConfig(), currentView, activeResult);
    });
  });

  // ========== Zoom Fit ==========
  document.getElementById('btnZoomFit').addEventListener('click', () => {
    const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    renderer.render(getConfig(), currentView, activeResult);
  });

  // ========== Render G-code and Stats tab helper ==========
  function displayGcodeResult() {
    const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    if (!activeResult || !activeResult.gcode) {
      document.getElementById('gcodeOutput').innerHTML = `<code>; NC 코드가 여기에 표시됩니다.\n; 설정을 조정한 후 "NC 파일 생성" 버튼을 클릭하세요.</code>`;
      document.getElementById('statLines').textContent = '—';
      document.getElementById('statTime').textContent = '—';
      document.getElementById('statDistance').textContent = '—';
      return;
    }

    const highlighted = highlightGCode(activeResult.gcode);
    document.getElementById('gcodeOutput').innerHTML = highlighted;

    // Stats
    document.getElementById('statLines').textContent = activeResult.lines.toLocaleString();
    const mins = activeResult.estimatedTime;
    if (mins >= 60) {
      document.getElementById('statTime').textContent = `${Math.floor(mins/60)}h ${Math.round(mins%60)}m`;
    } else {
      document.getElementById('statTime').textContent = `${Math.round(mins)}분`;
    }
    document.getElementById('statDistance').textContent = `${(activeResult.totalDistance / 1000).toFixed(1)} m`;
  }

  // ========== G-code Sub Tabs Switcher ==========
  const tabFrame = document.getElementById('tabGcodeFrame');
  const tabTemplate = document.getElementById('tabGcodeTemplate');

  tabFrame.addEventListener('click', () => {
    tabFrame.classList.add('active');
    tabTemplate.classList.remove('active');
    currentGcodeTab = 'frame';
    displayGcodeResult();
    renderer.render(getConfig(), currentView, lastResult.frame);
  });

  tabTemplate.addEventListener('click', () => {
    tabTemplate.classList.add('active');
    tabFrame.classList.remove('active');
    currentGcodeTab = 'template';
    displayGcodeResult();
    renderer.render(getConfig(), currentView, lastResult.template);
  });

  // ========== Generate Set (Frame & Gada Template) ==========
  document.getElementById('btnGenerate').addEventListener('click', () => {
    const config = getConfig();
    const btn = document.getElementById('btnGenerate');
    btn.classList.add('generating');
    btn.disabled = true;

    // Simulate brief processing
    setTimeout(() => {
      // Parallel generation
      const frameRes = generator.generate(config);
      const templateRes = generator.generateTemplate(config);
      
      btn.classList.remove('generating');
      btn.disabled = false;

      if (frameRes.error) {
        showToast(frameRes.error, 'error');
        return;
      }
      if (templateRes.error) {
        showToast(templateRes.error, 'error');
        return;
      }

      lastResult.frame = frameRes;
      lastResult.template = templateRes;

      // Update current displayed G-code
      displayGcodeResult();

      // Enable download buttons & restore template btn style
      const btnDl = document.getElementById('btnDownload');
      const btnDlTemp = document.getElementById('btnDownloadTemplate');
      
      btnDl.disabled = false;
      btnDlTemp.disabled = false;
      btnDlTemp.style.opacity = '1';
      btnDlTemp.style.cursor = 'pointer';

      // Switch to toolpath view
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tabToolpath').classList.add('active');
      currentView = 'toolpath';
      const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
      renderer.render(config, 'toolpath', activeResult);

      showToast(`액자 및 유리 가다용 NC 파일 세트 생성 완료!`, 'success');
    }, 300);
  });

  // ========== Download Frame G-code ==========
  document.getElementById('btnDownload').addEventListener('click', () => {
    if (!lastResult.frame || !lastResult.frame.gcode) return;
    const config = getConfig();
    const filename = `oval_frame_${config.ovalWidth}x${config.ovalHeight}.nc`;
    const blob = new Blob([lastResult.frame.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`액자 가공용 파일 (${filename}) 다운로드 완료!`, 'success');
  });

  // ========== Download Gada Template G-code ==========
  document.getElementById('btnDownloadTemplate').addEventListener('click', () => {
    if (!lastResult.template || !lastResult.template.gcode) return;
    const config = getConfig();
    const filename = `oval_template_gada_${config.ovalWidth}x${config.ovalHeight}.nc`;
    const blob = new Blob([lastResult.template.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`유리 가다용 파일 (${filename}) 다운로드 완료!`, 'success');
  });

  // ========== Copy Current Active G-code ==========
  document.getElementById('btnCopyCode').addEventListener('click', () => {
    const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    if (!activeResult || !activeResult.gcode) {
      showToast('먼저 G-code 세트를 생성하세요.', 'info');
      return;
    }
    navigator.clipboard.writeText(activeResult.gcode).then(() => {
      const typeStr = currentGcodeTab === 'frame' ? '액자 가공용' : '유리 가다용';
      showToast(`${typeStr} G-code가 클립보드에 복사되었습니다.`, 'success');
    }).catch(() => {
      showToast('복사 실패. 브라우저 권한을 확인하세요.', 'error');
    });
  });

  // ========== Reset ==========
  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('ovalWidth').value = 300;
    document.getElementById('ovalHeight').value = 400;
    document.getElementById('frameWidth').value = 20;
    document.getElementById('rabbetWidth').value = 5;
    document.getElementById('rabbitDepth').value = 10;
    document.getElementById('materialThickness').value = 15;
    document.getElementById('woodType').value = 'hardwood';
    document.getElementById('toolDiameter').value = 6;
    document.getElementById('toolFlutes').value = '2';
    document.getElementById('cncModel').value = 'ttc450pro';
    document.getElementById('tabCount').value = 4;
    document.getElementById('tabWidth').value = 6;
    document.getElementById('tabHeight').value = 2;
    document.getElementById('finishAllowance').value = 0.3;
    document.getElementById('cutDirection').value = 'climb';
    document.getElementById('originPosition').value = 'center';
    document.getElementById('enableRabbit').checked = true;
    document.getElementById('enableFinishPass').checked = true;

    lastResult.frame = null;
    lastResult.template = null;
    currentGcodeTab = 'frame';

    tabFrame.classList.add('active');
    tabTemplate.classList.remove('active');

    displayGcodeResult();

    const btnDl = document.getElementById('btnDownload');
    const btnDlTemp = document.getElementById('btnDownloadTemplate');
    btnDl.disabled = true;
    btnDlTemp.disabled = true;
    btnDlTemp.style.opacity = '0.25';
    btnDlTemp.style.cursor = 'not-allowed';

    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tabTop').classList.add('active');
    currentView = 'top';

    updateCalcDisplay();
    showToast('설정이 초기화되었습니다.', 'info');
  });

  // ========== G-code Syntax Highlighting ==========
  function highlightGCode(code) {
    return code.split('\n').map(line => {
      if (line.startsWith(';')) {
        return `<span class="gc-comment">${escapeHtml(line)}</span>`;
      }
      let highlighted = escapeHtml(line);
      highlighted = highlighted.replace(/\b(G[0-9]+|M[0-9]+)\b/g, '<span class="gc-command">$1</span>');
      highlighted = highlighted.replace(/(Z)([-\d.]+)/g, '<span class="gc-special">$1$2</span>');
      highlighted = highlighted.replace(/([XYE])([-\d.]+)/g, '<span class="gc-coord">$1$2</span>');
      highlighted = highlighted.replace(/(F)([\d.]+)/g, '<span class="gc-feed">$1$2</span>');
      highlighted = highlighted.replace(/(S)([\d.]+)/g, '<span class="gc-spindle">$1$2</span>');
      return highlighted;
    }).join('\n');
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ========== Toast ==========
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
    };
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3200);
  }

  // ========== Live Update on Input Change ==========
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('change', updateCalcDisplay);
    input.addEventListener('input', updateCalcDisplay);
  });

  // Connect renderer orbit redraw trigger
  renderer.redrawTrigger = () => {
    const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    renderer.render(getConfig(), currentView, activeResult);
  };

  // ========== Presets System ==========
  const PRESET_KEY = 'oval_cam_presets';

  function getPresets() {
    try {
      return JSON.parse(localStorage.getItem(PRESET_KEY)) || {};
    } catch(e) {
      return {};
    }
  }

  function savePresets(presets) {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
  }

  function updatePresetDropdown() {
    const presets = getPresets();
    const select = document.getElementById('presetSelect');
    
    // Clear old options except the first one
    select.innerHTML = '<option value="">-- 프리셋 선택 --</option>';
    
    Object.keys(presets).sort().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  function loadSelectedPreset() {
    const select = document.getElementById('presetSelect');
    const name = select.value;
    if (!name) return;

    const presets = getPresets();
    const config = presets[name];
    if (!config) return;

    // Apply config values to inputs
    Object.keys(config).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = config[key];
        } else {
          el.value = config[key];
        }
      }
    });

    document.getElementById('presetName').value = name;
    updateCalcDisplay();
    showToast(`'${name}' 프리셋을 불러왔습니다.`, 'success');
  }

  function savePreset() {
    const nameInput = document.getElementById('presetName');
    const name = nameInput.value.trim();
    if (!name) {
      showToast('프리셋 이름을 입력해주세요.', 'error');
      return;
    }

    const presets = getPresets();
    const config = getConfig();

    if (presets[name]) {
      if (!confirm(`'${name}' 프리셋이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return;
      }
    }

    presets[name] = config;
    savePresets(presets);
    updatePresetDropdown();
    document.getElementById('presetSelect').value = name;
    showToast(`'${name}' 프리셋이 저장되었습니다.`, 'success');
  }

  function deletePreset() {
    const select = document.getElementById('presetSelect');
    const name = select.value || document.getElementById('presetName').value.trim();
    
    if (!name) {
      showToast('삭제할 프리셋을 선택하거나 이름을 입력해주세요.', 'error');
      return;
    }

    const presets = getPresets();
    if (!presets[name]) {
      showToast(`'${name}' 프리셋을 찾을 수 없습니다.`, 'error');
      return;
    }

    if (!confirm(`'${name}' 프리셋을 정말 삭제하시겠습니까?`)) {
      return;
    }

    delete presets[name];
    savePresets(presets);
    updatePresetDropdown();
    
    document.getElementById('presetSelect').value = '';
    document.getElementById('presetName').value = '';
    showToast(`'${name}' 프리셋이 삭제되었습니다.`, 'info');
  }

  function exportPreset() {
    const config = getConfig();
    const name = document.getElementById('presetName').value.trim() || 'oval_settings';
    const jsonStr = JSON.stringify(config, null, 2);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}_settings.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('세팅 설정 파일(.json)을 다운로드했습니다.', 'success');
  }

  function importPreset(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const config = JSON.parse(evt.target.result);
        
        // Basic schema validation check
        if (!config.ovalWidth || !config.ovalHeight || !config.frameWidth) {
          showToast('올바른 설정 파일이 아닙니다.', 'error');
          return;
        }

        // Apply config values to inputs
        Object.keys(config).forEach(key => {
          const el = document.getElementById(key);
          if (el) {
            if (el.type === 'checkbox') {
              el.checked = config[key];
            } else {
              el.value = config[key];
            }
          }
        });

        // Set preset name input from filename
        const presetName = file.name.replace('_settings.json', '').replace('.json', '');
        document.getElementById('presetName').value = presetName;

        updateCalcDisplay();
        showToast('설정 파일에서 세팅을 정상적으로 불러왔습니다.', 'success');
      } catch(err) {
        showToast('파일을 읽는 도중 오류가 발생했습니다.', 'error');
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be imported again
    e.target.value = '';
  }

  // Wires Preset events
  document.getElementById('presetSelect').addEventListener('change', loadSelectedPreset);
  document.getElementById('btnSavePreset').addEventListener('click', savePreset);
  document.getElementById('btnDeletePreset').addEventListener('click', deletePreset);
  document.getElementById('btnExportPreset').addEventListener('click', exportPreset);
  document.getElementById('importPresetFile').addEventListener('change', importPreset);

  // ========== Initial Render ==========
  updatePresetDropdown();
  updateCalcDisplay();
})();
