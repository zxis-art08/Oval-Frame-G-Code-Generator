/**
 * App Controller — STUDIOHYUN Cam Tool
 * Wires UI, Preview Renderer, and G-code Generator
 */

(function() {
  const generator = new GCodeGenerator();
  const canvas = document.getElementById('previewCanvas');
  const renderer = new PreviewRenderer(canvas);

  let currentModule = 'oval'; // 'oval' or 'nameplate'
  let currentView = 'top';
  let lastResult = { frame: null, template: null, nameplate: null };
  let currentGcodeTab = 'frame'; // 'frame' or 'template' (for oval)

  // ========== Google Fonts Paths (Local Primary, CDN Fallback) ==========
  // ========== Google Fonts Paths (Local Primary, CDN Fallback) ==========
  const FONT_PATHS = {
    // Offline priority fonts (Local asset files)
    NanumGothic: {
      local: 'fonts/NanumGothic-Regular.ttf',
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf'
    },
    NanumMyeongjo: {
      local: 'fonts/NanumMyeongjo-Regular.ttf',
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf'
    },
    Jua: {
      local: 'fonts/Jua-Regular.ttf',
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/jua/Jua-Regular.ttf'
    },
    BlackHanSans: {
      local: 'fonts/BlackHanSans-Regular.ttf',
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/blackhansans/BlackHanSans-Regular.ttf'
    },
    SpaceGrotesk: {
      local: 'fonts/SpaceGrotesk-Regular.ttf',
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf'
    },
    // Online-only Google Fonts (Dynamic CDN load)
    NanumPenScript: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumpenscript/NanumPenScript-Regular.ttf'
    },
    NanumBrushScript: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf'
    },
    GowunDodum: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/gowundodum/GowunDodum-Regular.ttf'
    },
    GowunBatang: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/gowunbatang/GowunBatang-Regular.ttf'
    },
    Dongle: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/dongle/Dongle-Regular.ttf'
    },
    SingleDay: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/singleday/SingleDay-Regular.ttf'
    },
    SongMyung: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/songmyung/SongMyung-Regular.ttf'
    },
    EastSeaDokdo: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/eastseadokdo/EastSeaDokdo-Regular.ttf'
    },
    GamjaFlower: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/gamjaflower/GamjaFlower-Regular.ttf'
    },
    DoHyeon: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/dohyeon/DoHyeon-Regular.ttf'
    },
    YeonSung: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/yeonsung/YeonSung-Regular.ttf'
    },
    PoorStory: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poorstory/PoorStory-Regular.ttf'
    },
    BagelFatOne: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bagelfatone/BagelFatOne-Regular.ttf'
    },
    Orbit: {
      local: null,
      cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/orbit/Orbit-Regular.ttf'
    }
  };

  let loadedFonts = {};
  let activeFont = null;
  let activeFont2 = null;

  // ========== Preset Storage Keys ==========
  const OVAL_PRESET_KEY = 'oval_cam_presets';
  const NP_PRESET_KEY = 'nameplate_cam_presets';

  // ========== Config Gathering ==========
  function getOvalConfig() {
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

  function getNameplateConfig() {
    return {
      width:             parseFloat(document.getElementById('npWidth').value) || 400,
      height:            parseFloat(document.getElementById('npHeight').value) || 80,
      thickness:         parseFloat(document.getElementById('npThickness').value) || 20,
      woodType:          document.getElementById('npWoodType').value,
      shankDiameter:     parseFloat(document.getElementById('npShankDiameter').value) || 3.175,
      tipRadius:         parseFloat(document.getElementById('npTipRadius').value) || 0.1,
      bitAngle:          parseFloat(document.getElementById('npBitAngle').value) || 45,
      toolFlutes:        parseInt(document.getElementById('npToolFlutes').value) || 1,
      cncModel:          document.getElementById('npCncModel').value,
      engraveDepth:      parseFloat(document.getElementById('npEngraveDepth').value) || 1.5,
      safeZ:             parseFloat(document.getElementById('npSafeZ').value) || 5.0,
      originPosition:    document.getElementById('npOriginPosition').value,
      // Text 1 options
      text:              document.getElementById('npText').value,
      fontName:          document.getElementById('npFont').value,
      fontSize:          parseFloat(document.getElementById('npFontSize').value) || 25,
      offsetX:           parseFloat(document.getElementById('npOffsetX').value) || 0,
      offsetY:           parseFloat(document.getElementById('npOffsetY').value) || 0,
      bold:              document.getElementById('npFontBold').checked,
      engraveMode:       document.getElementById('npEngraveMode').value,
      // Text 2 options
      enableText2:       document.getElementById('npEnableText2').checked,
      text2:             document.getElementById('npText2').value,
      fontName2:         document.getElementById('npFont2').value,
      fontSize2:         parseFloat(document.getElementById('npFontSize2').value) || 12,
      offsetX2:          parseFloat(document.getElementById('npOffsetX2').value) || 0,
      offsetY2:          parseFloat(document.getElementById('npOffsetY2').value) || 0,
      bold2:             document.getElementById('npFontBold2').checked
    };
  }

  // ========== Dynamic Font Loading (Offline-First Hybrid) ==========
  function loadFont(fontName, isSecondFont = false) {
    if (loadedFonts[fontName]) {
      if (isSecondFont) activeFont2 = loadedFonts[fontName];
      else activeFont = loadedFonts[fontName];
      updateCalcDisplay();
      return Promise.resolve(loadedFonts[fontName]);
    }

    const paths = FONT_PATHS[fontName];
    if (!paths) return Promise.reject('Invalid font name');

    const statusEl = document.getElementById('fontStatus');
    const statusTextEl = document.getElementById('fontStatusText');
    statusEl.style.display = 'flex';
    statusTextEl.textContent = `글꼴 '${fontName}' 불러오는 중...`;

    const setFont = (font) => {
      loadedFonts[fontName] = font;
      if (isSecondFont) activeFont2 = font;
      else activeFont = font;
      statusEl.style.display = 'none';
      updateCalcDisplay();
    };

    // If local path is null, bypass directly to CDN (Online-only google web font)
    if (!paths.local) {
      statusTextEl.textContent = `구글 CDN에서 '${fontName}' 다운로드 중...`;
      return opentype.load(paths.cdn)
        .then(font => {
          setFont(font);
          showToast(`구글 웹폰트 '${fontName}' 다운로드 완료!`, 'success');
          return font;
        })
        .catch(cdnErr => {
          statusEl.style.display = 'none';
          showToast(`구글 웹폰트 로드 실패! 인터넷 연결 상태를 확인하세요.`, 'error');
          console.error(`Font load failed for ${fontName} from CDN:`, cdnErr);
        });
    }

    // Try loading local first, fallback to CDN if it fails
    return opentype.load(paths.local)
      .then(font => {
        setFont(font);
        showToast(`로컬 글꼴 '${fontName}' 불러오기 완료!`, 'success');
        return font;
      })
      .catch(localErr => {
        console.warn(`Local font load failed for ${fontName}, trying CDN...`, localErr);
        statusTextEl.textContent = `로컬 실패. 구글 CDN에서 '${fontName}' 다운로드 중...`;
        
        return opentype.load(paths.cdn)
          .then(font => {
            setFont(font);
            showToast(`CDN에서 글꼴 '${fontName}' 불러오기 완료!`, 'success');
            return font;
          })
          .catch(cdnErr => {
            statusEl.style.display = 'none';
            showToast(`글꼴 로드 실패! 외부 인터넷 연결 상태를 확인하거나 로컬 폰트파일(.ttf)을 직접 업로드하세요.`, 'error');
            console.error('All font load attempts failed:', cdnErr);
          });
      });
  }

  // ========== Update Calculated Params & Preview ==========
  function updateCalcDisplay() {
    if (currentModule === 'oval') {
      const config = getOvalConfig();
      const params = generator.calculateParams(config);
      
      document.getElementById('calcRPM').textContent = params.rpm.toLocaleString();
      document.getElementById('calcFeed').textContent = `${params.feedRate.toLocaleString()} mm/min`;
      document.getElementById('calcDOC').textContent = `${params.doc} mm`;
      document.getElementById('calcPlunge').textContent = `${params.plungeRate.toLocaleString()} mm/min`;
      document.getElementById('calcStepover').textContent = `${params.stepover} mm (${Math.round(params.stepover / config.toolDiameter * 100)}%)`;
      document.getElementById('calcSafeZ').textContent = `${params.safeZ} mm`;

      const spec = params.spec;
      document.getElementById('machineInfo').textContent = 
        `작업 영역: ${spec.workArea[0]}×${spec.workArea[1]}mm / 최대 RPM: ${spec.maxRPM.toLocaleString()} / 최대 이송: ${spec.maxFeed.toLocaleString()} mm/min`;

      const activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
      renderer.render(config, currentView, activeResult);
    } else {
      const config = getNameplateConfig();
      // Gather machining params (simulating calculateParams using diameter & wood type)
      const params = generator.calculateParams({
        cncModel: config.cncModel,
        toolDiameter: config.shankDiameter,
        toolFlutes: config.toolFlutes,
        woodType: config.woodType
      });

      // Engraving specific DOC override for V-bit tip safety
      const npDoc = Math.min(params.doc, 0.5);

      document.getElementById('calcNpRPM').textContent = params.rpm.toLocaleString();
      document.getElementById('calcNpFeed').textContent = `${params.feedRate.toLocaleString()} mm/min`;
      document.getElementById('calcNpDOC').textContent = `${npDoc} mm`;
      document.getElementById('calcNpPlunge').textContent = `${params.plungeRate.toLocaleString()} mm/min`;

      const spec = params.spec;
      document.getElementById('npMachineInfo').textContent = 
        `작업 영역: ${spec.workArea[0]}×${spec.workArea[1]}mm / 최대 RPM: ${spec.maxRPM.toLocaleString()} / 최대 이송: ${spec.maxFeed.toLocaleString()} mm/min`;

      // Pass font outline to renderer
      config.font = activeFont;
      config.font2 = activeFont2;
      renderer.render(config, currentView, lastResult.nameplate);
    }
  }

  // ========== Module Tabs Navigation ==========
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.disabled) return;
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentModule = item.getAttribute('data-module');

      const ovalGroup = document.getElementById('ovalSettingsGroup');
      const npGroup = document.getElementById('nameplateSettingsGroup');
      const textToolbar = document.getElementById('textToolbar');
      const gcodeTabsContainer = document.getElementById('gcodeTabsContainer');
      const ovalDownloads = document.getElementById('ovalDownloadButtons');
      const npDownloads = document.getElementById('nameplateDownloadButtons');
      const appModeBadge = document.getElementById('appModeBadge');
      const btnGenerateText = document.getElementById('btnGenerateText');

      if (currentModule === 'oval') {
        ovalGroup.classList.remove('hidden');
        npGroup.classList.add('hidden');
        textToolbar.classList.add('hidden');
        gcodeTabsContainer.classList.remove('hidden');
        ovalDownloads.classList.remove('hidden');
        npDownloads.classList.add('hidden');
        appModeBadge.textContent = 'OVAL FRAME';
        btnGenerateText.textContent = 'GENERATE G-CODE SET';
      } else {
        ovalGroup.classList.add('hidden');
        npGroup.classList.remove('hidden');
        textToolbar.classList.remove('hidden');
        gcodeTabsContainer.classList.add('hidden');
        ovalDownloads.classList.add('hidden');
        npDownloads.classList.remove('hidden');
        appModeBadge.textContent = 'NAMEPLATE';
        btnGenerateText.textContent = 'GENERATE NAMEPLATE G-CODE';

        // Load font on active module switch if not loaded
        if (!activeFont) {
          const fontVal = document.getElementById('npFont').value;
          loadFont(fontVal, false);
        }
        if (document.getElementById('npEnableText2').checked && !activeFont2) {
          const fontVal2 = document.getElementById('npFont2').value;
          loadFont(fontVal2, true);
        }
      }

      // Update preset dropdown for current module
      updatePresetDropdown();
      updateCalcDisplay();
      displayGcodeResult();
    });
  });

  // ========== Section Toggle Collapse/Expand ==========
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

  // ========== Canvas View Tabs (Top View vs Toolpath) ==========
  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.getAttribute('data-view');
      updateCalcDisplay();
    });
  });

  function setPreviewTabActive(viewType) {
    document.querySelectorAll('.preview-tab').forEach(t => {
      if (t.getAttribute('data-view') === viewType) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
  }

  // ========== Zoom Fit ==========
  document.getElementById('btnZoomFit').addEventListener('click', () => {
    updateCalcDisplay();
  });

  // ========== Render G-code and Stats tab helper ==========
  function displayGcodeResult() {
    let activeResult = null;
    if (currentModule === 'oval') {
      activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
    } else {
      activeResult = lastResult.nameplate;
    }

    if (!activeResult || !activeResult.gcode) {
      document.getElementById('gcodeOutput').innerHTML = `<code>; NC 코드가 여기에 표시됩니다.\n; 설정을 조정한 후 "NC 파일 생성" 버튼을 클릭하세요.</code>`;
      document.getElementById('statLines').textContent = '—';
      document.getElementById('statTime').textContent = '—';
      document.getElementById('statDistance').textContent = '—';
      
      if (currentModule === 'nameplate') {
        updateValidationReport(null);
      }
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

    if (currentModule === 'nameplate') {
      updateValidationReport(activeResult.safetyReport);
    }
  }

  // ========== G-code Sub Tabs Switcher (Only for Oval) ==========
  const tabFrame = document.getElementById('tabGcodeFrame');
  const tabTemplate = document.getElementById('tabGcodeTemplate');

  tabFrame.addEventListener('click', () => {
    tabFrame.classList.add('active');
    tabTemplate.classList.remove('active');
    currentGcodeTab = 'frame';
    displayGcodeResult();
    updateCalcDisplay();
  });

  tabTemplate.addEventListener('click', () => {
    tabTemplate.classList.add('active');
    tabFrame.classList.remove('active');
    currentGcodeTab = 'template';
    displayGcodeResult();
    updateCalcDisplay();
  });

  // ========== G-code Generation Event ==========
  document.getElementById('btnGenerate').addEventListener('click', () => {
    const btn = document.getElementById('btnGenerate');
    btn.classList.add('generating');
    btn.disabled = true;

    setTimeout(() => {
      if (currentModule === 'oval') {
        const config = getOvalConfig();
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

        displayGcodeResult();

        // Enable download buttons
        document.getElementById('btnDownload').disabled = false;
        const btnDlTemp = document.getElementById('btnDownloadTemplate');
        btnDlTemp.disabled = false;
        btnDlTemp.style.opacity = '1';
        btnDlTemp.style.cursor = 'pointer';

        // Switch to toolpath view
        setPreviewTabActive('toolpath');
        currentView = 'toolpath';
        updateCalcDisplay();

        showToast(`액자 및 유리 가다용 NC 파일 세트 생성 완료!`, 'success');
      } else {
        const config = getNameplateConfig();
        if (config.text && !activeFont) {
          btn.classList.remove('generating');
          btn.disabled = false;
          showToast('메인 폰트 파일을 불러오는 중입니다. 잠시 후 다시 시도하세요.', 'error');
          return;
        }
        if (config.enableText2 && config.text2 && !activeFont2) {
          btn.classList.remove('generating');
          btn.disabled = false;
          showToast('추가 폰트(텍스트 2) 파일을 불러오는 중입니다. 잠시 후 다시 시도하세요.', 'error');
          return;
        }

        const result = generator.generateNameplate(config, activeFont, activeFont2);

        btn.classList.remove('generating');
        btn.disabled = false;

        if (result.error) {
          showToast(result.error, 'error');
          // Update safety report to danger if blocked
          if (result.safetyReport) {
            updateValidationReport(result.safetyReport);
          }
          return;
        }

        lastResult.nameplate = result;
        displayGcodeResult();

        // Enable nameplate download button
        document.getElementById('btnDownloadNameplate').disabled = false;

        // Switch to toolpath view
        setPreviewTabActive('toolpath');
        currentView = 'toolpath';
        updateCalcDisplay();

        showToast(`명패 각인용 NC 파일 생성 완료!`, 'success');
      }
    }, 300);
  });

  // ========== Download Click Actions ==========
  document.getElementById('btnDownload').addEventListener('click', () => {
    if (!lastResult.frame || !lastResult.frame.gcode) return;
    const config = getOvalConfig();
    const filename = `oval_frame_${config.ovalWidth}x${config.ovalHeight}.nc`;
    downloadFile(lastResult.frame.gcode, filename);
    showToast(`액자 가공용 파일 (${filename}) 다운로드 완료!`, 'success');
  });

  document.getElementById('btnDownloadTemplate').addEventListener('click', () => {
    if (!lastResult.template || !lastResult.template.gcode) return;
    const config = getOvalConfig();
    const filename = `oval_template_gada_${config.ovalWidth}x${config.ovalHeight}.nc`;
    downloadFile(lastResult.template.gcode, filename);
    showToast(`유리 가다용 파일 (${filename}) 다운로드 완료!`, 'success');
  });

  document.getElementById('btnDownloadNameplate').addEventListener('click', () => {
    if (!lastResult.nameplate || !lastResult.nameplate.gcode) return;
    const config = getNameplateConfig();
    // Sanitize text for filename
    const cleanText = config.text.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').substring(0, 15);
    const filename = `nameplate_${cleanText}_${config.width}x${config.height}.nc`;
    downloadFile(lastResult.nameplate.gcode, filename);
    showToast(`명패 각인용 파일 (${filename}) 다운로드 완료!`, 'success');
  });

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========== Copy Current Active G-code ==========
  document.getElementById('btnCopyCode').addEventListener('click', () => {
    let activeResult = null;
    let typeStr = '';
    
    if (currentModule === 'oval') {
      activeResult = currentGcodeTab === 'frame' ? lastResult.frame : lastResult.template;
      typeStr = currentGcodeTab === 'frame' ? '액자 가공용' : '유리 가다용';
    } else {
      activeResult = lastResult.nameplate;
      typeStr = '명패 각인용';
    }

    if (!activeResult || !activeResult.gcode) {
      showToast('먼저 NC 가공코드를 생성하세요.', 'info');
      return;
    }
    
    navigator.clipboard.writeText(activeResult.gcode).then(() => {
      showToast(`${typeStr} G-code가 클립보드에 복사되었습니다.`, 'success');
    }).catch(() => {
      showToast('복사 실패. 브라우저 권한을 확인하세요.', 'error');
    });
  });

  // ========== Reset All Settings ==========
  document.getElementById('btnReset').addEventListener('click', () => {
    if (currentModule === 'oval') {
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

      document.getElementById('btnDownload').disabled = true;
      const btnDlTemp = document.getElementById('btnDownloadTemplate');
      btnDlTemp.disabled = true;
      btnDlTemp.style.opacity = '0.25';
      btnDlTemp.style.cursor = 'not-allowed';
    } else {
      document.getElementById('npWidth').value = 400;
      document.getElementById('npHeight').value = 80;
      document.getElementById('npThickness').value = 20;
      document.getElementById('npWoodType').value = 'hardwood';
      document.getElementById('npShankDiameter').value = 3.175;
      document.getElementById('npTipRadius').value = 0.1;
      document.getElementById('npBitAngle').value = 45;
      document.getElementById('npToolFlutes').value = '1';
      document.getElementById('npCncModel').value = 'ttc450pro';
      document.getElementById('npEngraveDepth').value = 1.5;
      document.getElementById('npSafeZ').value = 5.0;
      document.getElementById('npOriginPosition').value = 'bottomleft';

      document.getElementById('npText').value = '김민수';
      document.getElementById('npFont').value = 'NanumGothic';
      document.getElementById('npFontSize').value = 25;
      document.getElementById('npOffsetX').value = 25;
      document.getElementById('npOffsetY').value = 0;
      document.getElementById('npFontBold').checked = false;
      document.getElementById('npEngraveMode').value = 'trace';

      document.getElementById('npEnableText2').checked = false;
      document.getElementById('text2Row').classList.add('hidden');
      document.getElementById('npText2').value = '교장';
      document.getElementById('npFont2').value = 'NanumGothic';
      document.getElementById('npFontSize2').value = 12;
      document.getElementById('npOffsetX2').value = -30;
      document.getElementById('npOffsetY2').value = 0;
      document.getElementById('npFontBold2').checked = false;

      lastResult.nameplate = null;
      activeFont2 = null;
      document.getElementById('btnDownloadNameplate').disabled = true;
      updateValidationReport(null);
      
      // Reload default fonts
      loadFont('NanumGothic', false);
    }

    displayGcodeResult();

    setPreviewTabActive('top');
    currentView = 'top';

    updateCalcDisplay();
    showToast('현재 모듈의 설정이 초기화되었습니다.', 'info');
  });

  // ========== Font Uploading & Selector binding ==========
  const npFontSelect = document.getElementById('npFont');
  npFontSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      document.getElementById('fontFileInput').click();
    } else {
      loadFont(val, false);
    }
  });

  document.getElementById('btnUploadFont').addEventListener('click', () => {
    document.getElementById('fontFileInput').click();
  });

  // Text 2 Font selector & Upload binding
  const npFont2Select = document.getElementById('npFont2');
  npFont2Select.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom2') {
      document.getElementById('fontFileInput2').click();
    } else {
      loadFont(val, true);
    }
  });

  document.getElementById('btnUploadFont2').addEventListener('click', () => {
    document.getElementById('fontFileInput2').click();
  });

  document.getElementById('fontFileInput2').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const font = opentype.parse(evt.target.result);
        loadedFonts['custom2'] = font;
        activeFont2 = font;

        const customOption = npFont2Select.querySelector('option[value="custom2"]');
        customOption.textContent = `커스텀2: ${file.name.substring(0, 10)}`;
        npFont2Select.value = 'custom2';

        updateCalcDisplay();
        showToast(`업로드한 폰트 '${file.name}'를 텍스트2에 적용했습니다.`, 'success');
      } catch(evtErr) {
        showToast('올바른 글꼴 파일(.ttf, .otf)이 아닙니다.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  });

  // Text 2 Visibility Toggle binding
  const npEnableText2 = document.getElementById('npEnableText2');
  const text2Row = document.getElementById('text2Row');
  npEnableText2.addEventListener('change', () => {
    if (npEnableText2.checked) {
      text2Row.classList.remove('hidden');
      if (!activeFont2) {
        loadFont(npFont2Select.value, true);
      }
    } else {
      text2Row.classList.add('hidden');
    }
    updateCalcDisplay();
  });

  document.getElementById('fontFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const font = opentype.parse(evt.target.result);
        loadedFonts['custom'] = font;
        activeFont = font;

        const customOption = npFontSelect.querySelector('option[value="custom"]');
        customOption.textContent = `커스텀: ${file.name.substring(0, 12)}`;
        npFontSelect.value = 'custom';

        updateCalcDisplay();
        showToast(`업로드한 폰트 '${file.name}'를 적용했습니다.`, 'success');
      } catch(err) {
        showToast('올바른 글꼴 파일(.ttf, .otf)이 아닙니다.', 'error');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Clear value
  });

  // ========== Safety Validation UI Update ==========
  function updateValidationReport(report) {
    const reportStatus = document.getElementById('reportStatus');
    const reportStatusText = document.getElementById('reportStatusText');
    const reportDetails = document.getElementById('reportDetails');

    if (!report) {
      reportStatus.className = 'report-status status-safe';
      reportStatusText.textContent = '각인 가공 가능 (대기 중)';
      reportDetails.textContent = '설정을 조정한 후 "G-CODE 생성" 버튼을 클릭하면 안전성 검사 리포트가 여기에 생성됩니다.';
      return;
    }

    reportStatus.className = `report-status status-${report.status}`;
    reportStatusText.textContent = report.statusText;
    reportDetails.innerHTML = report.details;
  }

  // ========== Preset System Integration ==========
  function getActivePresetKey() {
    return currentModule === 'oval' ? OVAL_PRESET_KEY : NP_PRESET_KEY;
  }

  function getPresets() {
    const key = getActivePresetKey();
    try {
      return JSON.parse(localStorage.getItem(key)) || {};
    } catch(e) {
      return {};
    }
  }

  function savePresets(presets) {
    const key = getActivePresetKey();
    localStorage.setItem(key, JSON.stringify(presets));
  }

  function updatePresetDropdown() {
    const presets = getPresets();
    const prefix = currentModule === 'oval' ? '' : 'np';
    const select = document.getElementById(prefix ? 'npPresetSelect' : 'presetSelect');
    
    select.innerHTML = '<option value="">-- 프리셋 선택 --</option>';
    
    Object.keys(presets).sort().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  function loadSelectedPreset() {
    const prefix = currentModule === 'oval' ? '' : 'np';
    const select = document.getElementById(prefix ? 'npPresetSelect' : 'presetSelect');
    const name = select.value;
    if (!name) return;

    const presets = getPresets();
    const config = presets[name];
    if (!config) return;

    // Apply configuration values
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

    document.getElementById(prefix ? 'npPresetName' : 'presetName').value = name;
    
    // For nameplate module, reload the selected preset fonts if changed
    if (currentModule === 'nameplate') {
      if (config.npFont && config.npFont !== 'custom') {
        loadFont(config.npFont, false);
      }
      if (config.npEnableText2) {
        document.getElementById('text2Row').classList.remove('hidden');
        if (config.npFont2 && config.npFont2 !== 'custom2') {
          loadFont(config.npFont2, true);
        }
      } else {
        document.getElementById('text2Row').classList.add('hidden');
      }
    }

    updateCalcDisplay();
    showToast(`'${name}' 프리셋을 불러왔습니다.`, 'success');
  }

  function savePreset() {
    const prefix = currentModule === 'oval' ? '' : 'np';
    const nameInput = document.getElementById(prefix ? 'npPresetName' : 'presetName');
    const name = nameInput.value.trim();
    if (!name) {
      showToast('프리셋 이름을 입력해주세요.', 'error');
      return;
    }

    const presets = getPresets();
    
    // Config properties to capture depending on active module
    let config = {};
    if (currentModule === 'oval') {
      config = {
        ovalWidth: parseFloat(document.getElementById('ovalWidth').value),
        ovalHeight: parseFloat(document.getElementById('ovalHeight').value),
        frameWidth: parseFloat(document.getElementById('frameWidth').value),
        rabbetWidth: parseFloat(document.getElementById('rabbetWidth').value),
        rabbitDepth: parseFloat(document.getElementById('rabbitDepth').value),
        materialThickness: parseFloat(document.getElementById('materialThickness').value),
        woodType: document.getElementById('woodType').value,
        toolDiameter: parseFloat(document.getElementById('toolDiameter').value),
        toolFlutes: parseInt(document.getElementById('toolFlutes').value),
        cncModel: document.getElementById('cncModel').value,
        tabCount: parseInt(document.getElementById('tabCount').value),
        tabWidth: parseFloat(document.getElementById('tabWidth').value),
        tabHeight: parseFloat(document.getElementById('tabHeight').value),
        finishAllowance: parseFloat(document.getElementById('finishAllowance').value),
        cutDirection: document.getElementById('cutDirection').value,
        originPosition: document.getElementById('originPosition').value,
        enableRabbit: document.getElementById('enableRabbit').checked,
        enableFinishPass: document.getElementById('enableFinishPass').checked
      };
    } else {
      config = {
        npWidth: parseFloat(document.getElementById('npWidth').value),
        npHeight: parseFloat(document.getElementById('npHeight').value),
        npThickness: parseFloat(document.getElementById('npThickness').value),
        npWoodType: document.getElementById('npWoodType').value,
        npShankDiameter: parseFloat(document.getElementById('npShankDiameter').value),
        npTipRadius: parseFloat(document.getElementById('npTipRadius').value),
        npBitAngle: parseFloat(document.getElementById('npBitAngle').value),
        npToolFlutes: parseInt(document.getElementById('npToolFlutes').value),
        npCncModel: document.getElementById('npCncModel').value,
        npEngraveDepth: parseFloat(document.getElementById('npEngraveDepth').value),
        npSafeZ: parseFloat(document.getElementById('npSafeZ').value),
        npOriginPosition: document.getElementById('npOriginPosition').value,
        npText: document.getElementById('npText').value,
        npFont: document.getElementById('npFont').value,
        npFontSize: parseFloat(document.getElementById('npFontSize').value),
        npOffsetX: parseFloat(document.getElementById('npOffsetX').value),
        npOffsetY: parseFloat(document.getElementById('npOffsetY').value),
        npFontBold: document.getElementById('npFontBold').checked,
        npEnableText2: document.getElementById('npEnableText2').checked,
        npText2: document.getElementById('npText2').value,
        npFont2: document.getElementById('npFont2').value,
        npFontSize2: parseFloat(document.getElementById('npFontSize2').value),
        npOffsetX2: parseFloat(document.getElementById('npOffsetX2').value),
        npOffsetY2: parseFloat(document.getElementById('npOffsetY2').value),
        npFontBold2: document.getElementById('npFontBold2').checked,
        npEngraveMode: document.getElementById('npEngraveMode').value
      };
    }

    if (presets[name]) {
      if (!confirm(`'${name}' 프리셋이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return;
      }
    }

    presets[name] = config;
    savePresets(presets);
    updatePresetDropdown();
    document.getElementById(prefix ? 'npPresetSelect' : 'presetSelect').value = name;
    showToast(`'${name}' 프리셋이 저장되었습니다.`, 'success');
  }

  function deletePreset() {
    const prefix = currentModule === 'oval' ? '' : 'np';
    const select = document.getElementById(prefix ? 'npPresetSelect' : 'presetSelect');
    const nameInput = document.getElementById(prefix ? 'npPresetName' : 'presetName');
    const name = select.value || nameInput.value.trim();
    
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
    
    select.value = '';
    nameInput.value = '';
    showToast(`'${name}' 프리셋이 삭제되었습니다.`, 'info');
  }

  function exportPreset() {
    const prefix = currentModule === 'oval' ? '' : 'np';
    const nameInput = document.getElementById(prefix ? 'npPresetName' : 'presetName');
    const name = nameInput.value.trim() || `${currentModule}_settings`;
    
    // Capture state config
    let config = {};
    if (currentModule === 'oval') {
      config = getOvalConfig();
    } else {
      config = getNameplateConfig();
      // Rename config keys to match input IDs for simple mapping
      config = {
        npWidth: config.width,
        npHeight: config.height,
        npThickness: config.thickness,
        npWoodType: config.woodType,
        npShankDiameter: config.shankDiameter,
        npTipRadius: config.tipRadius,
        npBitAngle: config.bitAngle,
        npToolFlutes: config.toolFlutes,
        npCncModel: config.cncModel,
        npEngraveDepth: config.engraveDepth,
        npSafeZ: config.safeZ,
        npOriginPosition: config.originPosition,
        npText: config.text,
        npFont: config.fontName,
        npFontSize: config.fontSize,
        npOffsetX: config.offsetX,
        npOffsetY: config.offsetY,
        npFontBold: config.bold,
        npEnableText2: config.enableText2,
        npText2: config.text2,
        npFont2: config.fontName2,
        npFontSize2: config.fontSize2,
        npOffsetX2: config.offsetX2,
        npOffsetY2: config.offsetY2,
        npFontBold2: config.bold2,
        npEngraveMode: config.engraveMode
      };
    }

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
    showToast('설정 파일(.json)을 다운로드했습니다.', 'success');
  }

  function importPreset(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const config = JSON.parse(evt.target.result);
        
        // Quick validate key names depending on active module
        const expectedKey = currentModule === 'oval' ? 'ovalWidth' : 'npWidth';
        if (!config[expectedKey]) {
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
        const prefix = currentModule === 'oval' ? '' : 'np';
        document.getElementById(prefix ? 'npPresetName' : 'presetName').value = presetName;

        // If Nameplate, reload the loaded fonts if they exist
        if (currentModule === 'nameplate') {
          if (config.npFont && config.npFont !== 'custom') {
            loadFont(config.npFont, false);
          }
          if (config.npEnableText2) {
            document.getElementById('text2Row').classList.remove('hidden');
            if (config.npFont2 && config.npFont2 !== 'custom2') {
              loadFont(config.npFont2, true);
            }
          } else {
            document.getElementById('text2Row').classList.add('hidden');
          }
        }

        updateCalcDisplay();
        showToast('설정 파일에서 세팅을 성공적으로 불러왔습니다.', 'success');
      } catch(err) {
        showToast('파일을 읽는 도중 오류가 발생했습니다.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Presets Events binding
  document.getElementById('presetSelect').addEventListener('change', loadSelectedPreset);
  document.getElementById('btnSavePreset').addEventListener('click', savePreset);
  document.getElementById('btnDeletePreset').addEventListener('click', deletePreset);
  document.getElementById('btnExportPreset').addEventListener('click', exportPreset);
  document.getElementById('importPresetFile').addEventListener('change', importPreset);

  document.getElementById('npPresetSelect').addEventListener('change', loadSelectedPreset);
  document.getElementById('btnNpSavePreset').addEventListener('click', savePreset);
  document.getElementById('btnNpDeletePreset').addEventListener('click', deletePreset);
  document.getElementById('btnNpExportPreset').addEventListener('click', exportPreset);
  document.getElementById('importNpPresetFile').addEventListener('change', importPreset);

  // ========== Event binding for all inputs/selects with Debounce ==========
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  const debouncedUpdate = debounce(updateCalcDisplay, 150);

  document.addEventListener('input', (e) => {
    const tag = e.target.tagName.toLowerCase();
    const type = e.target.type;
    const id = e.target.id;
    if ((tag === 'input' && type !== 'file') || tag === 'select') {
      if (id === 'npText' || id === 'npText2') {
        debouncedUpdate(); // 150ms debounce for text entry to prevent lag
      } else {
        updateCalcDisplay();
      }
    }
  });

  document.addEventListener('change', (e) => {
    const tag = e.target.tagName.toLowerCase();
    const type = e.target.type;
    const id = e.target.id;
    if ((tag === 'input' && type !== 'file') || tag === 'select') {
      if (id === 'npText' || id === 'npText2') {
        debouncedUpdate();
      } else {
        updateCalcDisplay();
      }
    }
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

  // ========== Toast Notification ==========
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

  // ========== Canvas Drag & Drop Text positioning (Premium UX) ==========
  let dragStartMouse = { x: 0, y: 0 };
  let dragStartOffset = { x: 0, y: 0 };
  let dragStartOffset2 = { x: 0, y: 0 };
  let activeDragTarget = null; // 'text1' or 'text2' or null

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function getPlateGeometry() {
    const s = renderer.scale;
    const cx = renderer.w / 2;
    const cy = renderer.h / 2;
    const config = getNameplateConfig();
    const plateW = config.width * s;
    const plateH = config.height * s;
    return {
      s,
      px: cx - plateW / 2,
      py: cy - plateH / 2,
      width: config.width,
      height: config.height
    };
  }

  function hitTestText(mx, my) {
    if (currentModule !== 'nameplate' || currentView !== 'top') return null;
    
    const geom = getPlateGeometry();
    const config = getNameplateConfig();
    
    // Check Text 2 first (overlapping check priority)
    if (config.enableText2 && config.text2 && activeFont2) {
      const hit = checkTextHit(config.text2, activeFont2, config.fontSize2, config.offsetX2, config.offsetY2, mx, my, geom);
      if (hit) return 'text2';
    }
    
    // Check Text 1
    if (config.text && activeFont) {
      const hit = checkTextHit(config.text, activeFont, config.fontSize, config.offsetX, config.offsetY, mx, my, geom);
      if (hit) return 'text1';
    }
    
    return null;
  }

  function checkTextHit(text, font, fontSize, offsetX, offsetY, mx, my, geom) {
    const { s, px, py, width, height } = geom;
    
    const testPath = font.getPath(text, 0, 0, fontSize);
    const bbox = testPath.getBoundingBox();
    const bx = (bbox.x1 + bbox.x2) / 2;
    const by = (bbox.y1 + bbox.y2) / 2;
    
    let tx = width / 2 - bx;
    let ty = height / 2 - by;
    
    tx += offsetX;
    ty -= offsetY;
    
    // Translate mouse px coordinate to plate relative mm coordinates (Y-down)
    const mx_mm = (mx - px) / s;
    const my_mm = (my - py) / s;
    
    const pad = 4; // 4mm padding click buffer
    const hitX = (mx_mm >= tx + bbox.x1 - pad) && (mx_mm <= tx + bbox.x2 + pad);
    const hitY = (my_mm >= ty + bbox.y1 - pad) && (my_mm <= ty + bbox.y2 + pad);
    
    return hitX && hitY;
  }

  function startDrag(e) {
    if (currentModule !== 'nameplate' || currentView !== 'top') return;
    
    const mouse = getMousePos(e);
    const hit = hitTestText(mouse.x, mouse.y);
    if (!hit) return;
    
    activeDragTarget = hit;
    
    const geom = getPlateGeometry();
    dragStartMouse = {
      x: mouse.x / geom.s,
      y: mouse.y / geom.s
    };
    
    const config = getNameplateConfig();
    dragStartOffset = { x: config.offsetX, y: config.offsetY };
    dragStartOffset2 = { x: config.offsetX2, y: config.offsetY2 };
    
    canvas.style.cursor = 'grabbing';
  }

  function dragMove(e) {
    if (currentModule !== 'nameplate' || currentView !== 'top') return;
    
    const mouse = getMousePos(e);
    
    if (activeDragTarget) {
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const geom = getPlateGeometry();
      const currentMouseMM = {
        x: mouse.x / geom.s,
        y: mouse.y / geom.s
      };
      
      const dx = currentMouseMM.x - dragStartMouse.x;
      const dy = dragStartMouse.y - currentMouseMM.y; // invert Y for CNC Y-up
      
      if (activeDragTarget === 'text1') {
        const newX = Math.round((dragStartOffset.x + dx) * 10) / 10;
        const newY = Math.round((dragStartOffset.y + dy) * 10) / 10;
        
        document.getElementById('npOffsetX').value = newX;
        document.getElementById('npOffsetY').value = newY;
      } else if (activeDragTarget === 'text2') {
        const newX2 = Math.round((dragStartOffset2.x + dx) * 10) / 10;
        const newY2 = Math.round((dragStartOffset2.y + dy) * 10) / 10;
        
        document.getElementById('npOffsetX2').value = newX2;
        document.getElementById('npOffsetY2').value = newY2;
      }
      
      updateCalcDisplay();
    } else {
      if (e.type === 'mousemove') {
        const hit = hitTestText(mouse.x, mouse.y);
        if (hit) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    }
  }

  function endDrag() {
    if (activeDragTarget) {
      activeDragTarget = null;
      canvas.style.cursor = 'default';
      showToast('글자 오프셋 위치가 변경되었습니다.', 'info');
    }
  }

  // Bind mouse and touch events to canvas/window
  canvas.addEventListener('mousedown', startDrag);
  canvas.addEventListener('touchstart', startDrag, { passive: true });

  window.addEventListener('mousemove', dragMove);
  window.addEventListener('touchmove', dragMove, { passive: false });

  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);

  // ========== Initial Render ==========
  updatePresetDropdown();
  updateCalcDisplay();
})();
