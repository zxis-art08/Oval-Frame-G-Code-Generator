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
    
    // Interactive 3D Rotation angles
    this.yaw = -Math.PI / 4;  // horizontal rotation
    this.pitch = Math.PI / 6;  // vertical tilt
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.redrawTrigger = null; // Callback for app-level redraw

    this.resize();
    this.setupEvents();
    window.addEventListener('resize', () => this.resize());
  }

  setupEvents() {
    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.currentView !== '3d') return;
      e.preventDefault(); // Prevent text selection and default browser drag behavior
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || this.currentView !== '3d') return;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      
      this.yaw += dx * 0.008;
      // Clamp pitch to avoid visual flips
      this.pitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, this.pitch + dy * 0.008));
      
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      
      if (this.redrawTrigger) {
        this.redrawTrigger();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });

    // Touch Events for mobile devices
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.currentView !== '3d') return;
      e.preventDefault();
      this.isDragging = true;
      const touch = e.touches[0];
      this.lastMousePos = { x: touch.clientX, y: touch.clientY };
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || this.currentView !== '3d') return;
      const touch = e.touches[0];
      const dx = touch.clientX - this.lastMousePos.x;
      const dy = touch.clientY - this.lastMousePos.y;
      
      this.yaw += dx * 0.012;
      this.pitch = Math.max(0.08, Math.min(Math.PI / 2 - 0.08, this.pitch + dy * 0.012));
      
      this.lastMousePos = { x: touch.clientX, y: touch.clientY };
      
      if (this.redrawTrigger) {
        this.redrawTrigger();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
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

  project3D(x, y, z, cx, cy, s) {
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    // 1. Spindle orbit rotation around Y axis (Yaw)
    const x1 = x * cosY - y * sinY;
    const y1 = x * sinY + y * cosY;

    // 2. Projection rotation around X axis (Pitch)
    const xProj = x1;
    const yProj = y1 * cosP - z * sinP;
    const zProj = y1 * sinP + z * cosP;

    // 3. Scale and offset
    return {
      x: cx + xProj * s,
      y: cy - yProj * s,
      depth: zProj
    };
  }

  /**
   * Draw Interactive 3D Orbiting Preview
   */
  draw3DView(config, gcodeResult) {
    this.resize();
    const ctx = this.ctx;
    const w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Dark canvas background
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

    const thick = config.materialThickness;
    const zTop = -thick / 2;
    const zBot = thick / 2;
    const zRab = -thick / 2 + config.rabbitDepth;

    const numSegs = 48; // Good balance of performance & detail
    const polys = [];

    // Helper to calculate face depth for sorting
    const getAvgDepth = (pts) => {
      let sumY1 = 0, sumZ = 0;
      const cosY = Math.cos(this.yaw);
      const sinY = Math.sin(this.yaw);
      const sinP = Math.sin(this.pitch);
      const cosP = Math.cos(this.pitch);

      pts.forEach(p => {
        const y1 = p.x * sinY + p.y * cosY;
        sumY1 += y1;
        sumZ += p.z;
      });

      const avgY1 = sumY1 / pts.length;
      const avgZ = sumZ / pts.length;
      return avgY1 * sinP + avgZ * cosP;
    };

    let displayWidth = config.ovalWidth;
    let displayHeight = config.ovalHeight;

    if (isTemplate) {
      // 가다 구멍 치수 = 관통 내경 + 2 * 래빗폭 + 11mm (즉 innerRx + 5.5 반경)
      const tempRx = innerRx + 5.5;
      const tempRy = innerRy + 5.5;
      displayWidth = tempRx * 2;
      displayHeight = tempRy * 2;
      
      // 가다 판재 외각 (구멍보다 20mm 넓게 설정)
      const plateRx = tempRx + 20;
      const plateRy = tempRy + 20;

      // Generate segments for the template ring
      for (let i = 0; i < numSegs; i++) {
        const t1 = (2 * Math.PI * i) / numSegs;
        const t2 = (2 * Math.PI * (i + 1)) / numSegs;
        const tMid = (t1 + t2) / 2;

        const c1 = Math.cos(t1), s1 = Math.sin(t1);
        const c2 = Math.cos(t2), s2 = Math.sin(t2);

        // Light factor (light source from top-right-front)
        const lightCos = Math.cos(tMid - Math.PI / 4);
        const light = (lightCos + 1) / 2; // 0 to 1

        const pOutTop1 = { x: plateRx * c1, y: plateRy * s1, z: zTop };
        const pOutTop2 = { x: plateRx * c2, y: plateRy * s2, z: zTop };
        const pOutBot1 = { x: plateRx * c1, y: plateRy * s1, z: zBot };
        const pOutBot2 = { x: plateRx * c2, y: plateRy * s2, z: zBot };

        const pInTop1 = { x: tempRx * c1, y: tempRy * s1, z: zTop };
        const pInTop2 = { x: tempRx * c2, y: tempRy * s2, z: zTop };
        const pInBot1 = { x: tempRx * c1, y: tempRy * s1, z: zBot };
        const pInBot2 = { x: tempRx * c2, y: tempRy * s2, z: zBot };

        // Colors with dynamic shading (The Verge Cyber theme)
        const topColor = `rgba(${Math.round(40 + light * 15)}, ${Math.round(40 + light * 15)}, ${Math.round(40 + light * 15)}, 0.95)`;
        const outColor = `rgba(${Math.round(25 + light * 10)}, ${Math.round(25 + light * 10)}, ${Math.round(25 + light * 10)}, 0.95)`;
        const inColor = `rgba(${Math.round(15 + light * 8)}, ${Math.round(15 + light * 8)}, ${Math.round(15 + light * 8)}, 0.95)`;

        // 1. Top Face (plate outer to inner hole)
        const topPts = [pOutTop1, pOutTop2, pInTop2, pInTop1];
        polys.push({ points: topPts, color: topColor, depth: getAvgDepth(topPts), border: '#949494' });

        // 2. Outer Side Wall
        const outPts = [pOutTop1, pOutTop2, pOutBot2, pOutBot1];
        polys.push({ points: outPts, color: outColor, depth: getAvgDepth(outPts), border: '#2d2d2d' });

        // 3. Inner Hole Wall
        const inPts = [pInTop1, pInTop2, pInBot2, pInBot1];
        polys.push({ points: inPts, color: inColor, depth: getAvgDepth(inPts), border: '#1d1d1d' });
      }

    } else {
      // Generate segments for Frame
      for (let i = 0; i < numSegs; i++) {
        const t1 = (2 * Math.PI * i) / numSegs;
        const t2 = (2 * Math.PI * (i + 1)) / numSegs;
        const tMid = (t1 + t2) / 2;

        const c1 = Math.cos(t1), s1 = Math.sin(t1);
        const c2 = Math.cos(t2), s2 = Math.sin(t2);

        // Light factor (light source from top-right-front)
        const lightCos = Math.cos(tMid - Math.PI / 4);
        const light = (lightCos + 1) / 2; // 0 to 1

        // 3D Points
        const pOutTop1 = { x: outerRx * c1, y: outerRy * s1, z: zTop };
        const pOutTop2 = { x: outerRx * c2, y: outerRy * s2, z: zTop };
        const pOutBot1 = { x: outerRx * c1, y: outerRy * s1, z: zBot };
        const pOutBot2 = { x: outerRx * c2, y: outerRy * s2, z: zBot };

        const pRabTop1 = { x: innerRx * c1, y: innerRy * s1, z: zTop };
        const pRabTop2 = { x: innerRx * c2, y: innerRy * s2, z: zTop };
        const pRabBot1 = { x: innerRx * c1, y: innerRy * s1, z: zRab };
        const pRabBot2 = { x: innerRx * c2, y: innerRy * s2, z: zRab };

        const pHoleTop1 = { x: holeRx * c1, y: holeRy * s1, z: zRab };
        const pHoleTop2 = { x: holeRx * c2, y: holeRy * s2, z: zRab };
        const pHoleBot1 = { x: holeRx * c1, y: holeRy * s1, z: zBot };
        const pHoleBot2 = { x: holeRx * c2, y: holeRy * s2, z: zBot };

        // Colors with dynamic shading (The Verge Cyber theme)
        const topColor = `rgba(${Math.round(40 + light * 15)}, ${Math.round(40 + light * 15)}, ${Math.round(40 + light * 15)}, 0.95)`;
        const outColor = `rgba(${Math.round(25 + light * 10)}, ${Math.round(25 + light * 10)}, ${Math.round(25 + light * 10)}, 0.95)`;
        const rabWallColor = `rgba(${Math.round(20 + light * 10)}, ${Math.round(20 + light * 10)}, ${Math.round(20 + light * 10)}, 0.95)`;
        const shelfColor = `rgba(${Math.round(140 + light * 44)}, ${Math.round(90 + light * 44)}, ${Math.round(220 + light * 35)}, 0.95)`; // Brightened Neon Purple
        const inColor = `rgba(${Math.round(15 + light * 8)}, ${Math.round(15 + light * 8)}, ${Math.round(15 + light * 8)}, 0.95)`;

        // 1. Top Face
        const topPts = [pOutTop1, pOutTop2, pRabTop2, pRabTop1];
        polys.push({ points: topPts, color: topColor, depth: getAvgDepth(topPts), border: '#949494' });

        // 2. Outer Side Wall
        const outPts = [pOutTop1, pOutTop2, pOutBot2, pOutBot1];
        polys.push({ points: outPts, color: outColor, depth: getAvgDepth(outPts), border: '#2d2d2d' });

        // 3. Rabbet Vertical Wall
        if (config.enableRabbit) {
          const rabPts = [pRabTop1, pRabTop2, pRabBot2, pRabBot1];
          polys.push({ points: rabPts, color: rabWallColor, depth: getAvgDepth(rabPts), border: '#b886ff' });

          // 4. Rabbet Floor (Shelf)
          const shelfPts = [pRabBot1, pRabBot2, pHoleTop2, pHoleTop1];
          polys.push({ points: shelfPts, color: shelfColor, depth: getAvgDepth(shelfPts), border: '#3cffd0' });
        }

        // 5. Inner Opening Wall
        const inPts = [pHoleTop1, pHoleTop2, pHoleBot2, pHoleBot1];
        polys.push({ points: inPts, color: inColor, depth: getAvgDepth(inPts), border: '#1d1d1d' });
      }
    }

    // Sort polygons: draw furthest (lowest depth) first, closest (highest depth) last
    polys.sort((a, b) => a.depth - b.depth);

    // Calculate scale to fit
    const padding = 80;
    const fitSize = isTemplate ? (displayWidth + 40) : config.ovalWidth;
    const scaleX = (w - padding * 2) / fitSize;
    const scaleY = (h - padding * 2) / fitSize;
    const s = Math.min(scaleX, scaleY) * 0.9;
    const cx = w / 2, cy = h / 2;

    // Draw all polygons
    for (const poly of polys) {
      const projected = poly.points.map(p => this.project3D(p.x, p.y, p.z, cx, cy, s));
      
      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let j = 1; j < projected.length; j++) {
        ctx.lineTo(projected[j].x, projected[j].y);
      }
      ctx.closePath();

      ctx.fillStyle = poly.color;
      ctx.fill();

      ctx.strokeStyle = poly.border;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Annotations overlay (flat on top left)
    ctx.fillStyle = '#949494';
    ctx.font = '700 11px "Space Mono"';
    ctx.textAlign = 'left';
    ctx.fillText('마우스 드래그로 회전 가능', 15, 20);

    ctx.fillStyle = '#b886ff';
    ctx.fillText(`재료 두께: ${config.materialThickness}mm`, 15, 38);
    if (!isTemplate && config.enableRabbit) {
      ctx.fillStyle = '#b886ff';
      ctx.fillText(`래빗 깊이: ${config.rabbitDepth}mm`, 15, 56);
    }
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

  render(config, view, gcodeResult) {
    this.currentView = view;
    if (view === 'top') this.drawTopView(config, gcodeResult);
    else if (view === '3d') this.draw3DView(config, gcodeResult);
    else if (view === 'toolpath') this.drawToolpath(config, gcodeResult);
  }
}

window.PreviewRenderer = PreviewRenderer;
