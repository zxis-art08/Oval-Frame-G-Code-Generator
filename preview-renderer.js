/**
 * Preview Renderer — Canvas-based toolpath and frame visualization
 */

class PreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentView = 'top';
    this.scale = 1;
    this.offset = { x: 0, y: 0 };
    this.animFrame = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = container.clientWidth;
    this.h = container.clientHeight;
  }

  /**
   * Draw the top-down preview of the oval frame
   */
  drawTopView(config, gcodeResult) {
    this.resize();
    const ctx = this.ctx;
    const w = this.w, h = this.h;

    ctx.clearRect(0, 0, w, h);

    // Background (Canvas Black)
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, 0, w, h);

    const isTemplate = gcodeResult && gcodeResult.isTemplate;

    // Calculate dimensions
    const outerRx = config.ovalWidth / 2;
    const outerRy = config.ovalHeight / 2;
    const innerRx = outerRx - config.frameWidth;
    const innerRy = outerRy - config.frameWidth;
    const rabbetWidth = config.rabbetWidth || 5;
    const holeRx = innerRx - rabbetWidth;
    const holeRy = innerRy - rabbetWidth;

    let displayWidth = config.ovalWidth;
    let displayHeight = config.ovalHeight;

    if (isTemplate) {
      // 가다 구멍 치수 = 관통 내경 + 2 * 래빗폭 + 11mm (즉 innerRx + 5.5 반경)
      const tempRx = innerRx + 5.5;
      const tempRy = innerRy + 5.5;
      displayWidth = tempRx * 2;
      displayHeight = tempRy * 2;
    }

    // Calculate scale to fit
    const padding = 60;
    const scaleX = (w - padding * 2) / Math.max(config.ovalWidth, displayWidth + 40);
    const scaleY = (h - padding * 2) / Math.max(config.ovalHeight, displayHeight + 40);
    this.scale = Math.min(scaleX, scaleY);
    const s = this.scale;
    const cx = w / 2, cy = h / 2;

    // Draw grid
    this.drawGrid(ctx, cx, cy, s, w, h);

    // Draw work area boundary (460x460) - Ultraviolet
    ctx.strokeStyle = 'rgba(184, 134, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(cx - 230 * s, cy - 230 * s, 460 * s, 460 * s);
    ctx.setLineDash([]);

    if (isTemplate) {
      const tempRx = innerRx + 5.5;
      const tempRy = innerRy + 5.5;
      const tempRxPx = tempRx * s;
      const tempRyPx = tempRy * s;
      
      // 가다 판재 외각 (구멍보다 20mm 넓게 설정)
      const plateRxPx = tempRxPx + 20 * s;
      const plateRyPx = tempRyPx + 20 * s;

      // 1. 가다 판재 바디 (Surface Slate Fill, White Border)
      ctx.beginPath();
      ctx.ellipse(cx, cy, plateRxPx, plateRyPx, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45, 45, 45, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. 가다 내경 구멍 (Background Canvas Black, Mint Outline)
      ctx.beginPath();
      ctx.ellipse(cx, cy, tempRxPx, tempRyPx, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#131313';
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 255, 208, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. 내경 정보 텍스트
      ctx.fillStyle = '#949494';
      ctx.font = '700 11px "Space Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('유리 가다 템플릿 판재', cx, cy - 10);
      ctx.fillStyle = '#3cffd0';
      ctx.fillText(`(가다 구멍 내경: ${displayWidth.toFixed(1)} × ${displayHeight.toFixed(1)}mm)`, cx, cy + 10);

      // 4. 안전 탭 그리기 (Jelly Mint)
      const tabCount = config.tabCount || 4;
      for (let i = 0; i < tabCount; i++) {
        const angle = (2 * Math.PI * i) / tabCount;
        const tx = cx + (tempRx - (config.toolDiameter / 2)) * s * Math.cos(angle);
        const ty = cy + (tempRy - (config.toolDiameter / 2)) * s * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#3cffd0';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 치수선 (가다 구멍 크기)
      this.drawDimension(ctx, cx - tempRxPx, cy + tempRyPx + 25, cx + tempRxPx, cy + tempRyPx + 25, `${displayWidth.toFixed(1)}mm (가다 내경)`, '#3cffd0');
      this.drawDimension(ctx, cx + tempRxPx + 25, cy - tempRyPx, cx + tempRxPx + 25, cy + tempRyPx, `${displayHeight.toFixed(1)}mm (가다 내경)`, '#3cffd0');

      // 원점 표시
      const ox = config.originPosition === 'center' ? cx : cx - plateRxPx;
      const oy = config.originPosition === 'center' ? cy : cy + plateRyPx;
      this.drawOrigin(ctx, ox, oy);

      // 5. 액자 가상 실루엣 보조선 및 프레임 폭 / 래빗 폭 치수 표시 (요청사항 반영)
      const outerRxPx = outerRx * s;
      const outerRyPx = outerRy * s;
      const innerRxPx = innerRx * s;
      const innerRyPx = innerRy * s;
      const holeRxPx = holeRx * s;
      const holeRyPx = holeRy * s;

      // 액자 외경 실루엣 (연한 회색 점선)
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRxPx, outerRyPx, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();

      // 래빗 외경 실루엣 (연한 보라색 점선)
      ctx.beginPath();
      ctx.ellipse(cx, cy, innerRxPx, innerRyPx, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(184, 134, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 관통 내경 실루엣 (연한 민트색 점선)
      ctx.beginPath();
      ctx.ellipse(cx, cy, holeRxPx, holeRyPx, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(60, 255, 208, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // 프레임 폭 치수선 (지시선 처리)
      if (innerRxPx > 0) {
        const fwStartX = cx + innerRxPx;
        const fwEndX = cx + outerRxPx;
        const fwY = cy - 20;
        const fwMidX = (fwStartX + fwEndX) / 2;

        // 영역 수평선
        ctx.beginPath();
        ctx.moveTo(fwStartX, fwY);
        ctx.lineTo(fwEndX, fwY);
        ctx.strokeStyle = 'rgba(184, 134, 255, 0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 우측 지시 꺾임선 (Leader Line)
        ctx.beginPath();
        ctx.moveTo(fwMidX, fwY);
        ctx.lineTo(cx + outerRxPx + 25, cy - 45);
        ctx.lineTo(cx + outerRxPx + 75, cy - 45);
        ctx.strokeStyle = 'rgba(184, 134, 255, 0.75)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 지시선 텍스트
        ctx.fillStyle = '#b886ff';
        ctx.font = '700 9.5px "Space Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`폭 ${config.frameWidth}mm`, cx + outerRxPx + 28, cy - 50);
      }

      // 래빗 폭 치수선 (지시선 처리)
      if (holeRxPx > 0 && innerRxPx > 0) {
        const rwStartX = cx + holeRxPx;
        const rwEndX = cx + innerRxPx;
        const rwY = cy + 20;
        const rwMidX = (rwStartX + rwEndX) / 2;

        // 영역 수평선
        ctx.beginPath();
        ctx.moveTo(rwStartX, rwY);
        ctx.lineTo(rwEndX, rwY);
        ctx.strokeStyle = 'rgba(60, 255, 208, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 우측 지시 꺾임선 (Leader Line)
        ctx.beginPath();
        ctx.moveTo(rwMidX, rwY);
        ctx.lineTo(cx + outerRxPx + 25, cy + 45);
        ctx.lineTo(cx + outerRxPx + 75, cy + 45);
        ctx.strokeStyle = 'rgba(60, 255, 208, 0.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 지시선 텍스트
        ctx.fillStyle = '#3cffd0';
        ctx.font = '700 9.5px "Space Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`턱 ${rabbetWidth}mm`, cx + outerRxPx + 28, cy + 40);
      }

      // 하단 정보 갱신
      document.getElementById('infoSize').textContent = `가다 내경 ${displayWidth.toFixed(1)} × ${displayHeight.toFixed(1)} mm`;
      document.getElementById('infoScale').textContent = `SCALE: ${s.toFixed(2)}px/mm (Gada Template Mode)`;

    } else {
      const outerRxPx = outerRx * s;
      const outerRyPx = outerRy * s;
      const innerRxPx = innerRx * s;
      const innerRyPx = innerRy * s;
      const holeRxPx = holeRx * s;
      const holeRyPx = holeRy * s;
      const toolD = (config.toolDiameter || 6) * s;
      const chunkRx = holeRxPx - toolD;
      const chunkRy = holeRyPx - toolD;

      // 1. Outer Frame Body (Surface Slate Fill, White Hairline)
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRxPx, outerRyPx, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45, 45, 45, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Rabbet Step Area (Mint Fill to match '턱' guides, Purple Outline)
      if (innerRxPx > 0 && innerRyPx > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, innerRxPx, innerRyPx, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(60, 255, 208, 0.12)';
        ctx.fill();
        ctx.strokeStyle = '#b886ff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Cutout Slot (Background Canvas Black shows through, Mint Outline)
      if (holeRxPx > 0 && holeRyPx > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, holeRxPx, holeRyPx, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#131313';
        ctx.fill();
        ctx.strokeStyle = 'rgba(60, 255, 208, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Center Chunk (reusable wood piece - Muted Outline)
      if (chunkRx > 0 && chunkRy > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, chunkRx, chunkRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(45, 45, 45, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#949494';
        ctx.font = '700 9px "Space Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('알맹이 덩어리', cx, cy - 35);
        ctx.fillText('(분리됨)', cx, cy - 22);
      }

      // Draw tabs on outer oval (Jelly Mint indicators)
      const tabCount = config.tabCount || 4;
      for (let i = 0; i < tabCount; i++) {
        const angle = (2 * Math.PI * i) / tabCount;
        const tx = cx + outerRxPx * Math.cos(angle);
        const ty = cy + outerRyPx * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#3cffd0';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Dimension annotations (Jelly Mint)
      this.drawDimension(ctx, cx - outerRxPx, cy + outerRyPx + 25, cx + outerRxPx, cy + outerRyPx + 25, `${config.ovalWidth}mm`, '#3cffd0');
      this.drawDimension(ctx, cx + outerRxPx + 25, cy - outerRyPx, cx + outerRxPx + 25, cy + outerRyPx, `${config.ovalHeight}mm`, '#3cffd0');

      // Frame width annotation with Leader Line
      if (innerRxPx > 0) {
        const fwStartX = cx + innerRxPx;
        const fwEndX = cx + outerRxPx;
        const fwY = cy - 20;
        const fwMidX = (fwStartX + fwEndX) / 2;

        // 영역 수평선
        ctx.beginPath();
        ctx.moveTo(fwStartX, fwY);
        ctx.lineTo(fwEndX, fwY);
        ctx.strokeStyle = '#b886ff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 우측 지시 꺾임선 (Leader Line)
        ctx.beginPath();
        ctx.moveTo(fwMidX, fwY);
        ctx.lineTo(cx + outerRxPx + 25, cy - 45);
        ctx.lineTo(cx + outerRxPx + 75, cy - 45);
        ctx.strokeStyle = '#b886ff';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 지시선 텍스트
        ctx.fillStyle = '#b886ff';
        ctx.font = '700 9.5px "Space Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`폭 ${config.frameWidth}mm`, cx + outerRxPx + 28, cy - 50);
      }

      // Rabbet width annotation with Leader Line
      if (holeRxPx > 0 && innerRxPx > 0) {
        const rwStartX = cx + holeRxPx;
        const rwEndX = cx + innerRxPx;
        const rwY = cy + 20;
        const rwMidX = (rwStartX + rwEndX) / 2;

        // 영역 수평선
        ctx.beginPath();
        ctx.moveTo(rwStartX, rwY);
        ctx.lineTo(rwEndX, rwY);
        ctx.strokeStyle = '#3cffd0';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 우측 지시 꺾임선 (Leader Line)
        ctx.beginPath();
        ctx.moveTo(rwMidX, rwY);
        ctx.lineTo(cx + outerRxPx + 25, cy + 45);
        ctx.lineTo(cx + outerRxPx + 75, cy + 45);
        ctx.strokeStyle = '#3cffd0';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // 지시선 텍스트
        ctx.fillStyle = '#3cffd0';
        ctx.font = '700 9.5px "Space Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`턱 ${rabbetWidth}mm`, cx + outerRxPx + 28, cy + 40);
      }

      // Origin marker
      const ox = config.originPosition === 'center' ? cx : cx - outerRxPx;
      const oy = config.originPosition === 'center' ? cy : cy + outerRyPx;
      this.drawOrigin(ctx, ox, oy);

      // Update info
      document.getElementById('infoSize').textContent = `${config.ovalWidth} × ${config.ovalHeight} mm`;
      document.getElementById('infoScale').textContent = `SCALE: ${s.toFixed(2)}px/mm`;
    }
  }

  /**
   * Draw toolpath visualization
   */
  drawToolpath(config, gcodeResult) {
    this.resize();
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, 0, w, h);

    const padding = 60;
    const scaleX = (w - padding * 2) / config.ovalWidth;
    const scaleY = (h - padding * 2) / config.ovalHeight;
    const s = Math.min(scaleX, scaleY);
    const cx = w / 2, cy = h / 2;

    this.drawGrid(ctx, cx, cy, s, w, h);

    // Parse gcode lines for toolpath visualization
    if (!gcodeResult || !gcodeResult.gcode) return;

    const lines = gcodeResult.gcode.split('\n');
    let curX = 0, curY = 0;
    let isRapid = false;
    let currentOp = '';

    const colors = {
      'OP1': 'rgba(184, 134, 255, 0.55)',  // Verge Ultraviolet (Brightened)
      'OP2': 'rgba(60, 255, 208, 0.6)',  // Jelly Mint
      'OP3': 'rgba(255, 255, 255, 0.65)', // White
      'OP4': 'rgba(184, 134, 255, 0.85)'
    };

    ctx.lineWidth = 1.5;

    lines.forEach(line => {
      // Operation markers
      if (line.includes('OP1: RABBIT')) currentOp = 'OP1';
      else if (line.includes('OP2: INNER CUTOUT')) currentOp = 'OP2';
      else if (line.includes('OP3: OUTER CUTOUT')) currentOp = 'OP3';

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) return;

      const parts = trimmed.split(/\s+/);
      const isG0 = parts.includes('G0');
      const isG1 = parts.includes('G1');

      if (isG0) isRapid = true;
      else if (isG1) isRapid = false;

      let targetX = curX;
      let targetY = curY;
      let hasCoord = false;

      parts.forEach(p => {
        if (p.startsWith('X')) {
          targetX = parseFloat(p.substring(1));
          hasCoord = true;
        } else if (p.startsWith('Y')) {
          targetY = parseFloat(p.substring(1));
          hasCoord = true;
        }
      });

      if (hasCoord) {
        // Render toolpath
        ctx.beginPath();
        ctx.moveTo(cx + curX * s, cy - curY * s); // CNC coordinates Y-up, Canvas Y-down
        ctx.lineTo(cx + targetX * s, cy - targetY * s);

        if (isRapid) {
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.3)'; // red rapid path
          ctx.setLineDash([2, 2]);
          ctx.lineWidth = 0.75;
        } else {
          ctx.strokeStyle = colors[currentOp] || 'rgba(255,255,255,0.4)';
          ctx.setLineDash([]);
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();

        curX = targetX;
        curY = targetY;
      }
    });

    ctx.setLineDash([]);

    // Legend
    const legend = [
      { label: '래빗 가공', color: colors['OP1'] },
      { label: '내부 윤곽', color: colors['OP2'] },
      { label: '외부 윤곽', color: colors['OP3'] },
      { label: '마감 패스', color: colors['OP4'] }
    ];
    let ly = 20;
    ctx.font = '700 11px "Space Mono"';
    for (const item of legend) {
      ctx.fillStyle = item.color;
      ctx.fillRect(15, ly, 14, 14);
      ctx.fillStyle = '#949494';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, 35, ly + 11);
      ly += 22;
    }

    // Origin marker
    const ox = config.originPosition === 'center' ? cx : cx - (config.ovalWidth / 2) * s;
    const oy = config.originPosition === 'center' ? cy : cy + (config.ovalHeight / 2) * s;
    this.drawOrigin(ctx, ox, oy);

    // ========== SPECIFICATION CARD (시방서 - 요청사항 반영) ==========
    const isTemplate = gcodeResult && gcodeResult.isTemplate;
    const boxW = 230;
    const boxH = isTemplate ? 160 : 195;
    const boxX = w - boxW - 20;
    const boxY = 20;

    // 반투명 다크 배경 박스 (1px hairline)
    ctx.fillStyle = 'rgba(19, 19, 19, 0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // 시방서 헤더 타이틀
    ctx.fillStyle = isTemplate ? '#3cffd0' : '#b886ff'; // 가다: 민트, 프레임: 보라
    ctx.font = '700 10.5px "Space Mono"';
    ctx.textAlign = 'left';
    ctx.fillText(isTemplate ? 'SPEC SHEET: GLASS GADA' : 'SPEC SHEET: OVAL FRAME', boxX + 15, boxY + 24);

    // 헤더 구분선
    ctx.beginPath();
    ctx.moveTo(boxX + 15, boxY + 32);
    ctx.lineTo(boxX + boxW - 15, boxY + 32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 스펙 데이터 구성
    let specs = [];
    if (isTemplate) {
      const innerRx = (config.ovalWidth / 2) - config.frameWidth;
      const innerRy = (config.ovalHeight / 2) - config.frameWidth;
      const tempRx = innerRx + 5.5;
      const tempRy = innerRy + 5.5;
      const holeRx = innerRx - (config.rabbetWidth || 5);
      const holeRy = innerRy - (config.rabbetWidth || 5);
      
      specs = [
        { label: '가다 구멍 가로', value: (tempRx * 2).toFixed(1) + ' mm' },
        { label: '가다 구멍 세로', value: (tempRy * 2).toFixed(1) + ' mm' },
        { label: '내용물 규격(단턱)', value: (innerRx * 2).toFixed(0) + 'x' + (innerRy * 2).toFixed(0) + ' mm' },
        { label: '가다 판재 두께', value: config.materialThickness + ' mm' },
        { label: '가공 공구 사양', value: 'Ø' + config.toolDiameter + ' mm (' + config.toolFlutes + '날)' },
        { label: '안전 고정 탭', value: config.tabCount + '개 (' + config.tabWidth + 'x' + config.tabHeight + ')' }
      ];
    } else {
      const innerRx = (config.ovalWidth / 2) - config.frameWidth;
      const innerRy = (config.ovalHeight / 2) - config.frameWidth;
      const holeRx = innerRx - (config.rabbetWidth || 5);
      const holeRy = innerRy - (config.rabbetWidth || 5);
      
      specs = [
        { label: '액자 외경 규격', value: config.ovalWidth + 'x' + config.ovalHeight + ' mm' },
        { label: '프레임 테두리', value: config.frameWidth + ' mm' },
        { label: '단턱 홈 외경', value: (innerRx * 2) + 'x' + (innerRy * 2) + ' mm' },
        { label: '단턱 턱폭/깊이', value: (config.rabbetWidth || 5) + ' / ' + config.rabbitDepth + ' mm' },
        { label: '액자 관통 내경', value: (holeRx * 2) + 'x' + (holeRy * 2) + ' mm' },
        { label: '소재 가공 두께', value: config.materialThickness + ' mm' },
        { label: '가공 공구 사양', value: 'Ø' + config.toolDiameter + ' mm (' + config.toolFlutes + '날)' },
        { label: '안전 고정 탭', value: config.tabCount + '개 (' + config.tabWidth + 'x' + config.tabHeight + ')' }
      ];
    }

    // 데이터 리스트 렌더링
    let rowY = boxY + 50;
    ctx.font = '500 9px "Space Mono"';
    specs.forEach(s => {
      ctx.fillStyle = '#949494';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, boxX + 15, rowY);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(s.value, boxX + boxW - 15, rowY);
      
      rowY += 18;
    });
  }



  // ---- Helpers ----

  drawGrid(ctx, cx, cy, scale, w, h) {
    const gridStep = 10; // mm
    const gridPx = gridStep * scale;
    if (gridPx < 4) return;

    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;

    for (let x = cx % gridPx; x < w; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = cy % gridPx; y < h; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(184, 134, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.strokeStyle = 'rgba(60, 255, 208, 0.25)';
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  }

  drawOrigin(ctx, x, y) {
    const r = 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60, 255, 208, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#3cffd0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.fillStyle = '#3cffd0';
    ctx.font = 'bold 9px "Space Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('Origin', x + r + 4, y - 2);
  }

  drawDimension(ctx, x1, y1, x2, y2, label, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    // Arrowheads
    const arrowSize = 4;
    if (Math.abs(y1 - y2) < 1) { // Horizontal
      ctx.beginPath(); ctx.moveTo(x1, y1 - arrowSize); ctx.lineTo(x1, y1 + arrowSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2 - arrowSize); ctx.lineTo(x2, y2 + arrowSize); ctx.stroke();
    } else { // Vertical
      ctx.beginPath(); ctx.moveTo(x1 - arrowSize, y1); ctx.lineTo(x1 + arrowSize, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2 - arrowSize, y2); ctx.lineTo(x2 + arrowSize, y2); ctx.stroke();
    }

    ctx.font = '700 11px "Space Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

    // Background for text
    const metrics = ctx.measureText(label);
    const tw = metrics.width + 8;
    ctx.fillStyle = '#131313';
    if (Math.abs(y1 - y2) < 1) {
      ctx.fillRect(mx - tw / 2, my - 9, tw, 18);
    } else {
      ctx.fillRect(mx + 8, my - 9, tw, 18);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = color;
    if (Math.abs(y1 - y2) < 1) {
      ctx.fillText(label, mx, my);
    } else {
      ctx.fillText(label, mx + 12, my);
    }
  }

  drawNameplateTopView(config, gcodeResult) {
    this.resize();
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Canvas Background
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, 0, w, h);

    // Scaling
    const padding = 60;
    const scaleX = (w - padding * 2) / config.width;
    const scaleY = (h - padding * 2) / config.height;
    this.scale = Math.min(scaleX, scaleY);
    const s = this.scale;
    const cx = w / 2, cy = h / 2;

    // Grid & Axes
    this.drawGrid(ctx, cx, cy, s, w, h);

    // TwoTrees TTC 450 work area boundary (460x460)
    ctx.strokeStyle = 'rgba(184, 134, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(cx - 230 * s, cy - 230 * s, 460 * s, 460 * s);
    ctx.setLineDash([]);

    // 1. Material Plate (Slate grey fill, white outline)
    const plateW = config.width * s;
    const plateH = config.height * s;
    const px = cx - plateW / 2;
    const py = cy - plateH / 2;

    ctx.fillStyle = 'rgba(45, 45, 45, 0.85)';
    ctx.fillRect(px, py, plateW, plateH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, plateW, plateH);

    // 2. Text rendering (WYSIWYG)
    if (!config.text) {
      ctx.fillStyle = '#949494';
      ctx.font = '500 12px "Space Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('No Text Input', cx, cy);
    } else if (!config.font) {
      ctx.fillStyle = '#949494';
      ctx.font = '500 12px "Space Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Loading Font...', cx, cy);
    } else {
      const font = config.font;
      
      // Calculate font path bounding box at 0,0 to center it
      const testPath = font.getPath(config.text, 0, 0, config.fontSize);
      const bbox = testPath.getBoundingBox();

      // Find baseline offsets
      const bx = (bbox.x1 + bbox.x2) / 2;
      const by = (bbox.y1 + bbox.y2) / 2;

      // Centered position (relative to plate top-left in millimeters)
      let tx = config.width / 2 - bx;
      let ty = config.height / 2 - by;

      // Apply user offsets
      tx += config.offsetX;
      ty -= config.offsetY;

      // Apply bold styling if checked (we can simulate standard bold by drawing multiple overlapping strokes or loading bold font)
      // opentype.js draws custom curves. We will fetch the outline path.
      const path = font.getPath(config.text, tx, ty, config.fontSize);

      // Save context state, apply translation to plate top-left, and scale
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(s, s);

      // Draw the path outline representing the engraving cut
      ctx.beginPath();
      path.commands.forEach(cmd => {
        if (cmd.type === 'M') {
          ctx.moveTo(cmd.x, cmd.y);
        } else if (cmd.type === 'L') {
          ctx.lineTo(cmd.x, cmd.y);
        } else if (cmd.type === 'Q') {
          ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        } else if (cmd.type === 'C') {
          ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        } else if (cmd.type === 'Z') {
          ctx.closePath();
        }
      });

      // Fill with semi-transparent mint (engraved groove)
      ctx.fillStyle = 'rgba(60, 255, 208, 0.15)';
      ctx.fill();

      // Stroke outline (actual cutter path representation)
      ctx.strokeStyle = 'rgba(60, 255, 208, 0.95)';
      ctx.lineWidth = Math.max(0.5, config.toolDiameter); // show cutter thickness scaled
      if (config.bold) {
        ctx.lineWidth = Math.max(1.0, config.toolDiameter * 1.5);
      }
      ctx.stroke();

      ctx.restore();
    }

    // 3. Dimensions
    this.drawDimension(ctx, px, py + plateH + 25, px + plateW, py + plateH + 25, `${config.width} mm`, '#3cffd0');
    this.drawDimension(ctx, px + plateW + 25, py, px + plateW + 25, py + plateH, `${config.height} mm`, '#3cffd0');

    // 4. Origin Marker
    const ox = config.originPosition === 'center' ? cx : px;
    const oy = config.originPosition === 'center' ? cy : py + plateH;
    this.drawOrigin(ctx, ox, oy);

    // Update bottom info label
    document.getElementById('infoSize').textContent = `명패 ${config.width} × ${config.height} mm (두께 ${config.thickness}mm)`;
    document.getElementById('infoScale').textContent = `SCALE: ${s.toFixed(2)}px/mm`;
  }

  drawNameplateToolpath(config, gcodeResult) {
    this.resize();
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Canvas Background
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, 0, w, h);

    // Scaling
    const padding = 60;
    const scaleX = (w - padding * 2) / config.width;
    const scaleY = (h - padding * 2) / config.height;
    this.scale = Math.min(scaleX, scaleY);
    const s = this.scale;
    const cx = w / 2, cy = h / 2;

    // Grid & Axes
    this.drawGrid(ctx, cx, cy, s, w, h);

    // Plate Boundary
    const plateW = config.width * s;
    const plateH = config.height * s;
    const px = cx - plateW / 2;
    const py = cy - plateH / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px, py, plateW, plateH);
    ctx.setLineDash([]);

    // Parse G-code for rendering
    if (gcodeResult && gcodeResult.gcode) {
      const lines = gcodeResult.gcode.split('\n');
      let curX = 0, curY = 0;
      let isRapid = false;

      ctx.lineWidth = 1.2;

      // Coordinate mapping helper
      const mapCoords = (cncX, cncY) => {
        if (config.originPosition === 'center') {
          return { x: cx + cncX * s, y: cy - cncY * s };
        } else {
          return { x: px + cncX * s, y: py + plateH - cncY * s };
        }
      };

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';')) return;

        const parts = trimmed.split(/\s+/);
        const isG0 = parts.includes('G0');
        const isG1 = parts.includes('G1');

        if (isG0) isRapid = true;
        else if (isG1) isRapid = false;

        let targetX = curX;
        let targetY = curY;
        let hasCoord = false;

        parts.forEach(p => {
          if (p.startsWith('X')) {
            targetX = parseFloat(p.substring(1));
            hasCoord = true;
          } else if (p.startsWith('Y')) {
            targetY = parseFloat(p.substring(1));
            hasCoord = true;
          }
        });

        if (hasCoord) {
          const start = mapCoords(curX, curY);
          const end = mapCoords(targetX, targetY);

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);

          if (isRapid) {
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.3)'; // Red rapid move
            ctx.setLineDash([2, 2]);
            ctx.lineWidth = 0.75;
          } else {
            ctx.strokeStyle = 'rgba(60, 255, 208, 0.75)'; // Jelly Mint cutting path
            ctx.setLineDash([]);
            ctx.lineWidth = 1.5;
          }
          ctx.stroke();

          curX = targetX;
          curY = targetY;
        }
      });
      ctx.setLineDash([]);
    }

    // Legend
    ctx.font = '700 11px "Space Mono"';
    ctx.fillStyle = 'rgba(248, 113, 113, 0.6)';
    ctx.fillRect(15, 20, 14, 14);
    ctx.fillStyle = '#949494';
    ctx.textAlign = 'left';
    ctx.fillText('급속 이송 (G0)', 35, 31);

    ctx.fillStyle = 'rgba(60, 255, 208, 0.8)';
    ctx.fillRect(15, 42, 14, 14);
    ctx.fillStyle = '#949494';
    ctx.fillText('각인 가공 (G1)', 35, 53);

    // Origin Marker
    const ox = config.originPosition === 'center' ? cx : px;
    const oy = config.originPosition === 'center' ? cy : py + plateH;
    this.drawOrigin(ctx, ox, oy);

    // Spec Sheet Box Overlay
    const boxW = 230;
    const boxH = 175;
    const boxX = w - boxW - 20;
    const boxY = 20;

    ctx.fillStyle = 'rgba(19, 19, 19, 0.88)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#3cffd0'; // Jelly Mint
    ctx.font = '700 10.5px "Space Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('SPEC SHEET: NAMEPLATE', boxX + 15, boxY + 24);

    ctx.beginPath();
    ctx.moveTo(boxX + 15, boxY + 32);
    ctx.lineTo(boxX + boxW - 15, boxY + 32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const specs = [
      { label: '소재 규격', value: `${config.width}x${config.height} mm` },
      { label: '소재 두께', value: `${config.thickness} mm` },
      { label: '각인 깊이', value: `${config.engraveDepth} mm` },
      { label: '가공 공구 사양', value: `Ø${config.toolDiameter} mm (${config.toolFlutes}날)` },
      { label: '각인 문구', value: config.text.substring(0, 10) + (config.text.length > 10 ? '..' : '') },
      { label: '글자 정렬/크기', value: `${config.textAlign} / ${config.fontSize}mm` }
    ];

    let rowY = boxY + 50;
    ctx.font = '500 9px "Space Mono"';
    specs.forEach(s => {
      ctx.fillStyle = '#949494';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, boxX + 15, rowY);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(s.value, boxX + boxW - 15, rowY);
      
      rowY += 18;
    });
  }

  render(config, view, gcodeResult) {
    this.currentView = view;
    const isNameplate = config.text !== undefined;

    if (isNameplate) {
      if (view === 'top') this.drawNameplateTopView(config, gcodeResult);
      else if (view === 'toolpath') this.drawNameplateToolpath(config, gcodeResult);
    } else {
      if (view === 'top') this.drawTopView(config, gcodeResult);
      else if (view === 'toolpath') this.drawToolpath(config, gcodeResult);
    }
  }
}

window.PreviewRenderer = PreviewRenderer;
