/**
 * G-code Generator for Oval Frame CNC Machining
 * Target: TwoTrees 450 CNC (GRBL compatible)
 */

class GCodeGenerator {
  constructor() {
    // Machine specs per model
    this.machineSpecs = {
      ttc450:     { maxRPM: 8000,  maxFeed: 800,  workArea: [460,460,80],  name: 'TTC 450' },
      ttc450pro:  { maxRPM: 12000, maxFeed: 5000, workArea: [460,460,80],  name: 'TTC 450 Pro' },
      ttc450ultra:{ maxRPM: 30000, maxFeed: 3000, workArea: [460,460,100], name: 'TTC 450 Ultra' }
    };
    // Chip load table (mm per tooth)
    this.chipLoads = {
      softwood:  { '1': 0.20, '2': 0.18, '3': 0.15, '4': 0.15, '5': 0.18, '6': 0.22, '7': 0.22 },
      hardwood:  { '1': 0.12, '2': 0.10, '3': 0.08, '4': 0.10, '5': 0.12, '6': 0.15, '7': 0.15 },
      mdf:       { '1': 0.18, '2': 0.15, '3': 0.12, '4': 0.15, '5': 0.18, '6': 0.20, '7': 0.20 },
      plywood:   { '1': 0.15, '2': 0.12, '3': 0.10, '4': 0.12, '5': 0.15, '6': 0.18, '7': 0.18 }
    };
  }

  /**
   * Calculate optimal machining parameters
   */
  calculateParams(config) {
    const spec = this.machineSpecs[config.cncModel];
    const diam = config.toolDiameter;
    const flutes = config.toolFlutes;
    const diamKey = String(Math.round(diam));
    const chipLoad = (this.chipLoads[config.woodType] || this.chipLoads.hardwood)[diamKey] || 0.12;

    // Spindle RPM — use 80% of max for safety on hobby machines
    let rpm = Math.round(spec.maxRPM * 0.8);
    // For the base model, use max RPM since it's already low
    if (config.cncModel === 'ttc450') rpm = spec.maxRPM;

    // Feed rate = RPM × flutes × chipLoad
    let feedRate = Math.round(rpm * flutes * chipLoad);
    // Clamp to machine max
    feedRate = Math.min(feedRate, spec.maxFeed * 0.85);
    // For base model, be more conservative
    if (config.cncModel === 'ttc450') feedRate = Math.min(feedRate, 600);

    // Depth of cut — typically 50% of tool diameter for hobby machines
    let doc = config.depthPerPass !== undefined ? config.depthPerPass : (Math.round(diam * 0.4 * 10) / 10);
    if (config.depthPerPass === undefined) {
      if (config.woodType === 'hardwood') doc = Math.round(diam * 0.3 * 10) / 10;
      doc = Math.max(0.5, Math.min(doc, 4));
    }

    // Plunge rate — 30-40% of feed rate
    const plungeRate = Math.round(feedRate * 0.35);

    // Stepover — 40% of tool diameter for pocketing
    const stepover = Math.round(diam * 0.4 * 10) / 10;

    const safeZ = 5.0;

    return { rpm, feedRate, doc, plungeRate, stepover, safeZ, chipLoad, spec };
  }

  /**
   * Generate ellipse points
   */
  ellipsePoints(cx, cy, rx, ry, numPoints = 120) {
    const pts = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = (2 * Math.PI * i) / numPoints;
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    return pts;
  }

  /**
   * Apply ramping lead-in over the first 25% of points
   */
  applyRamping(pts, startZ, targetZ, enableRamping) {
    const rampSteps = enableRamping ? Math.floor((pts.length - 1) / 4) : 0;
    return pts.map((pt, idx) => {
      let z = targetZ;
      if (enableRamping && idx < rampSteps) {
        z = startZ + (targetZ - startZ) * (idx / rampSteps);
      }
      return { x: pt.x, y: pt.y, z };
    });
  }

  /**
   * Check if angle falls within a tab zone
   */
  isInTab(angle, tabAngles, tabArcHalf) {
    for (const ta of tabAngles) {
      let diff = Math.abs(angle - ta);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < tabArcHalf) return true;
    }
    return false;
  }

  /**
   * Generate the complete NC file
   */
  generate(config) {
    const params = this.calculateParams(config);
    const { rpm, feedRate, doc, plungeRate, stepover, safeZ } = params;

    const lines = [];
    let totalDist = 0;
    let lastX = null, lastY = null, lastZ = null;

    const addDist = (x, y, z) => {
      if (lastX !== null) {
        const dx = x - lastX, dy = y - lastY, dz = (z || 0) - (lastZ || 0);
        totalDist += Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
      lastX = x; lastY = y; lastZ = z || lastZ;
    };

    const fmt = (v) => v.toFixed(3);

    // Origin offset
    const offsetX = config.originPosition === 'center' ? 0 : config.ovalWidth / 2;
    const offsetY = config.originPosition === 'center' ? 0 : config.ovalHeight / 2;

    const outerRx = config.ovalWidth / 2;
    const outerRy = config.ovalHeight / 2;
    
    // 뒤쪽(배면) 프레임 폭을 뺀 래빗 외부 경계
    const innerRx = outerRx - config.frameWidth;
    const innerRy = outerRy - config.frameWidth;
    
    // 래빗 폭(턱 폭)을 추가로 뺀 관통 구멍 경계
    const rabbetWidth = config.rabbetWidth || 5;
    const holeRx = innerRx - rabbetWidth;
    const holeRy = innerRy - rabbetWidth;

    // Validate dimensions
    if (holeRx <= 2 || holeRy <= 2) {
      return { error: '프레임 폭과 래빗 폭의 합이 너무 넓습니다. 내부 공간이 부족합니다.' };
    }
    if (config.ovalWidth > 450 || config.ovalHeight > 450) {
      return { error: '프레임 크기가 CNC 작업 영역(460×460mm)을 초과합니다.' };
    }

    const numPts = 180; // Higher resolution for smoother curves
    const toolR = config.toolDiameter / 2;

    // ========== HEADER ==========
    lines.push(`; =============================================`);
    lines.push(`; 타원 액자 가공 — ${config.ovalWidth}×${config.ovalHeight}mm`);
    lines.push(`; Generated by STUDIOHYUN Cam Tool`);
    lines.push(`; 가공 장비: ${params.spec.name}`);
    lines.push(`; 가공 소재: ${config.woodType === 'hardwood' ? '경목/합판' : '연목/MDF'} / 두께 ${config.materialThickness}mm`);
    lines.push(`; 사용 공구: Ø${config.toolDiameter}mm ${config.toolFlutes}날 엔드밀`);
    lines.push(`; 생성 일자: ${new Date().toISOString().slice(0,10)}`);
    lines.push(`; =============================================`);
    lines.push('');
    lines.push(`; --- 가공 모델 파라미터 ---`);
    lines.push(`; 스핀들 속도: ${rpm} RPM`);
    lines.push(`; 이송 속도: ${feedRate} mm/min`);
    lines.push(`; 진입 속도: ${plungeRate} mm/min`);
    lines.push(`; 1회 절입량(DOC): ${doc} mm`);
    lines.push(`; 헬리컬 램프 진입: ${config.enableRamping ? '적용 (Ramp)' : '미적용 (Plunge)'}`);
    lines.push(`; 스텝오버: ${stepover} mm`);
    lines.push(`; 안전 높이: ${safeZ} mm`);
    lines.push('');

    // ========== INIT ==========
    lines.push('G90 ; 절대 좌표계 지정');
    lines.push('G21 ; 밀리미터 단위 지정');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이 이동`);
    lines.push(`M3 S${rpm} ; 스핀들 회전 시작`);
    lines.push('G4 P3 ; 스핀들 안정화 대기 (3초)');
    lines.push('');

    // ========== OPERATION 1: RABBIT (ring pocket) ==========
    if (config.enableRabbit) {
      lines.push('; ========== 공정 1: 내부 단턱 도넛 가공 (RABBIT) ==========');
      const rabbitDepth = config.rabbitDepth;
      const numZPasses = Math.ceil(rabbitDepth / doc);

      const rxStart = holeRx + toolR;
      const rxEnd = innerRx - toolR;
      const ryStart = holeRy + toolR;
      const ryEnd = innerRy - toolR;

      for (let zPass = 1; zPass <= numZPasses; zPass++) {
        const currentZ = -Math.min(zPass * doc, rabbitDepth);
        const startZ = -(zPass - 1) * doc;
        lines.push(`; --- 단턱 가공 Z 패스 ${zPass}/${numZPasses} (Z=${fmt(currentZ)}) ---`);

        if (rxStart >= rxEnd) {
          // 공구가 너무 굵어 한 번만 가공해도 턱을 채우는 경우
          const rx = (rxStart + rxEnd) / 2;
          const ry = (ryStart + ryEnd) / 2;
          const pts = this.ellipsePoints(offsetX, offsetY, rx, ry, numPts);
          const rampedPts = this.applyRamping(pts, startZ, currentZ, config.enableRamping);
          
          lines.push(`G0 X${fmt(rampedPts[0].x)} Y${fmt(rampedPts[0].y)}`);
          lines.push(`G1 Z${fmt(rampedPts[0].z)} F${plungeRate}`);
          for (let i = 1; i < rampedPts.length; i++) {
            lines.push(`G1 X${fmt(rampedPts[i].x)} Y${fmt(rampedPts[i].y)} Z${fmt(rampedPts[i].z)} F${feedRate}`);
            addDist(rampedPts[i].x, rampedPts[i].y, rampedPts[i].z);
          }
        } else {
          // stepover 간격으로 도넛 안쪽에서 바깥쪽으로 여러 번 깎기
          const steps = Math.max(2, Math.ceil((rxEnd - rxStart) / stepover));
          let firstMove = true;

          for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const rx = rxStart + t * (rxEnd - rxStart);
            const ry = ryStart + t * (ryEnd - ryStart);
            const pts = this.ellipsePoints(offsetX, offsetY, rx, ry, numPts);
            const rampedPts = this.applyRamping(pts, startZ, currentZ, config.enableRamping);

            if (firstMove) {
              lines.push(`G0 X${fmt(rampedPts[0].x)} Y${fmt(rampedPts[0].y)}`);
              lines.push(`G1 Z${fmt(rampedPts[0].z)} F${plungeRate}`);
              firstMove = false;
            } else {
              lines.push(`G0 Z${fmt(safeZ)}`);
              lines.push(`G0 X${fmt(rampedPts[0].x)} Y${fmt(rampedPts[0].y)}`);
              lines.push(`G1 Z${fmt(rampedPts[0].z)} F${plungeRate}`);
            }

            for (let i = 1; i < rampedPts.length; i++) {
              lines.push(`G1 X${fmt(rampedPts[i].x)} Y${fmt(rampedPts[i].y)} Z${fmt(rampedPts[i].z)} F${feedRate}`);
              addDist(rampedPts[i].x, rampedPts[i].y, rampedPts[i].z);
            }
          }
        }
        lines.push(`G0 Z${fmt(safeZ)}`);
      }
      lines.push('');
    }

    // ========== OPERATION 2: INNER PROFILE CUT ==========
    lines.push('; ========== 공정 2: 내경 관통 가공 (알맹이 분리) ==========');
    const innerToolRx = holeRx - toolR;
    const innerToolRy = holeRy - toolR;
    const fullDepth = config.materialThickness;
    const innerZPasses = Math.ceil(fullDepth / doc);

    for (let zPass = 1; zPass <= innerZPasses; zPass++) {
      const currentZ = -Math.min(zPass * doc, fullDepth);
      const startZ = -(zPass - 1) * doc;
      lines.push(`; --- 내경 관통 가공 Z 패스 ${zPass}/${innerZPasses} (Z=${fmt(currentZ)}) ---`);

      const pts = this.ellipsePoints(offsetX, offsetY, innerToolRx, innerToolRy, numPts);
      const rampedPts = this.applyRamping(pts, startZ, currentZ, config.enableRamping);

      lines.push(`G0 X${fmt(rampedPts[0].x)} Y${fmt(rampedPts[0].y)}`);
      lines.push(`G1 Z${fmt(rampedPts[0].z)} F${plungeRate}`);

      for (let i = 1; i < rampedPts.length; i++) {
        lines.push(`G1 X${fmt(rampedPts[i].x)} Y${fmt(rampedPts[i].y)} Z${fmt(rampedPts[i].z)} F${feedRate}`);
        addDist(rampedPts[i].x, rampedPts[i].y, rampedPts[i].z);
      }
      lines.push(`G0 Z${fmt(safeZ)}`);
    }
    lines.push('');

    // ========== OPERATION 3: OUTER PROFILE CUT WITH TABS ==========
    lines.push('; ========== 공정 3: 외경 윤곽 가공 (탭 포함) ==========');
    const outerToolRx = outerRx + toolR;
    const outerToolRy = outerRy + toolR;
    const tabCount = config.tabCount || 4;
    const tabAngles = [];
    for (let i = 0; i < tabCount; i++) {
      tabAngles.push((2 * Math.PI * i) / tabCount);
    }
    // Tab arc half-width (approximate)
    const avgR = (outerToolRx + outerToolRy) / 2;
    const tabArcHalf = (config.tabWidth / 2) / avgR;
    const tabTopZ = -(fullDepth - config.tabHeight);

    // Roughing passes (leave finish allowance)
    const allowance = config.finishAllowance || 0;
    const roughRx = outerToolRx + allowance;
    const roughRy = outerToolRy + allowance;
    const outerZPasses = Math.ceil(fullDepth / doc);

    if (allowance > 0 && config.enableFinishPass) {
      lines.push('; --- 황삭 가공 (여유량 남김) ---');
    }

    for (let zPass = 1; zPass <= outerZPasses; zPass++) {
      const targetZ = -Math.min(zPass * doc, fullDepth);
      const startZ = -(zPass - 1) * doc;
      const rx = (allowance > 0 && config.enableFinishPass) ? roughRx : outerToolRx;
      const ry = (allowance > 0 && config.enableFinishPass) ? roughRy : outerToolRy;
      lines.push(`; --- 외경 윤곽 가공 Z 패스 ${zPass}/${outerZPasses} (Z=${fmt(targetZ)}) ---`);

      const pts = [];
      const rampSteps = config.enableRamping ? Math.floor(numPts / 4) : 0;
      for (let i = 0; i <= numPts; i++) {
        const t = (2 * Math.PI * i) / numPts;
        const x = offsetX + rx * Math.cos(t);
        const y = offsetY + ry * Math.sin(t);

        let currentPtZ = targetZ;
        if (config.enableRamping && i < rampSteps) {
          currentPtZ = startZ + (targetZ - startZ) * (i / rampSteps);
        }

        const inTab = this.isInTab(t, tabAngles, tabArcHalf);
        const z = inTab ? Math.max(currentPtZ, tabTopZ) : currentPtZ;
        pts.push({ x, y, z });
      }

      lines.push(`G0 X${fmt(pts[0].x)} Y${fmt(pts[0].y)}`);
      lines.push(`G1 Z${fmt(pts[0].z)} F${plungeRate}`);

      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const prev = pts[i-1];
        if (Math.abs(p.z - prev.z) > 0.001) {
          lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)} F${feedRate * 0.7}`);
        } else {
          lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} F${feedRate}`);
        }
        addDist(p.x, p.y, p.z);
      }
      lines.push(`G0 Z${fmt(safeZ)}`);
    }

    // ========== FINISH PASS ==========
    if (config.enableFinishPass && allowance > 0) {
      lines.push('');
      lines.push('; ========== 공정 4: 외경 정삭 가공 (마감) ==========');
      const finishFeed = Math.round(feedRate * 0.7);

      for (let zPass = 1; zPass <= outerZPasses; zPass++) {
        const targetZ = -Math.min(zPass * doc, fullDepth);
        const startZ = -(zPass - 1) * doc;
        lines.push(`; --- 정삭 가공 Z 패스 ${zPass}/${outerZPasses} (Z=${fmt(targetZ)}) ---`);

        const pts = [];
        const rampSteps = config.enableRamping ? Math.floor(numPts / 4) : 0;
        for (let i = 0; i <= numPts; i++) {
          const t = (2 * Math.PI * i) / numPts;
          const x = offsetX + outerToolRx * Math.cos(t);
          const y = offsetY + outerToolRy * Math.sin(t);

          let currentPtZ = targetZ;
          if (config.enableRamping && i < rampSteps) {
            currentPtZ = startZ + (targetZ - startZ) * (i / rampSteps);
          }

          const inTab = this.isInTab(t, tabAngles, tabArcHalf);
          const z = inTab ? Math.max(currentPtZ, tabTopZ) : currentPtZ;
          pts.push({ x, y, z });
        }

        lines.push(`G0 X${fmt(pts[0].x)} Y${fmt(pts[0].y)}`);
        lines.push(`G1 Z${fmt(pts[0].z)} F${plungeRate}`);

        for (let i = 1; i < pts.length; i++) {
          const p = pts[i], prev = pts[i-1];
          if (Math.abs(p.z - prev.z) > 0.001) {
            lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)} F${finishFeed}`);
          } else {
            lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} F${finishFeed}`);
          }
          addDist(p.x, p.y, p.z);
        }
        lines.push(`G0 Z${fmt(safeZ)}`);
      }
    }

    // ========== FOOTER ==========
    lines.push('');
    lines.push('; ========== 가공 완료 (END) ==========');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이로 Z축 후퇴`);
    lines.push('M5 ; 스핀들 정지');
    lines.push('G0 X0 Y0 ; 기계 원점으로 귀환');
    lines.push('M2 ; 프로그램 종료');

    // Estimate time (very rough)
    const feedTimeMin = totalDist / feedRate;
    const rapidDist = outerZPasses * safeZ * 2 * 3; // rough estimate
    const rapidTimeMin = rapidDist / 3000;
    const totalTimeMin = feedTimeMin + rapidTimeMin;

    return {
      gcode: lines.join('\n'),
      lines: lines.length,
      totalDistance: Math.round(totalDist),
      estimatedTime: totalTimeMin,
      params
    };
  }

  /**
   * Generate the glass cutting template (Gada) G-code
   * Formula: Rabbet Outer Diameter (배면 내경) + tmplOffset
   */
  generateTemplate(config) {
    const params = this.calculateParams(config);
    const { rpm, feedRate, doc, plungeRate, safeZ } = params;

    const lines = [];
    let totalDist = 0;
    let lastX = null, lastY = null, lastZ = null;

    const addDist = (x, y, z) => {
      if (lastX !== null) {
        const dx = x - lastX, dy = y - lastY, dz = (z || 0) - (lastZ || 0);
        totalDist += Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
      lastX = x; lastY = y; lastZ = z || lastZ;
    };

    const fmt = (v) => v.toFixed(3);

    const targetRx = config.width / 2;
    const targetRy = config.height / 2;
    const toolR = config.toolDiameter / 2;
    const isInner = config.cutType === 'inner';

    const plateW = config.width + (isInner ? 40 : 20);
    const plateH = config.height + (isInner ? 40 : 20);

    // Origin offset
    const offsetX = config.originPosition === 'center' ? 0 : plateW / 2;
    const offsetY = config.originPosition === 'center' ? 0 : plateH / 2;

    const tempRx = isInner ? targetRx - toolR : targetRx + toolR;
    const tempRy = isInner ? targetRy - toolR : targetRy + toolR;

    // Validate dimensions
    if (tempRx <= 0.1 || tempRy <= 0.1) {
      return { error: '치수가 너무 작거나 공구 직경이 너무 커서 G-code를 생성할 수 없습니다.' };
    }
    if (plateW > 460 || plateH > 460) {
      return { error: '가공 크기가 CNC 작업 영역(460×460mm)을 초과합니다.' };
    }

    const numPts = 180;

    // ========== HEADER ==========
    lines.push(`; =============================================`);
    lines.push(`; 유리 가다용 템플릿 가공 — ${config.width}×${config.height}mm`);
    lines.push(`; 가공 모드: ${isInner ? 'Inside Cut (내경 가공)' : 'Outside Cut (외경 가공)'}`);
    lines.push(`; Generated by STUDIOHYUN Cam Tool (Template Mode)`);
    lines.push(`; 가공 장비: ${params.spec.name}`);
    lines.push(`; 가공 소재: MDF/합판 / 두께 ${config.materialThickness}mm`);
    lines.push(`; 사용 공구: Ø${config.toolDiameter}mm ${config.toolFlutes}날 엔드밀`);
    lines.push(`; 가공 목표 크기: ${config.width}x${config.height}mm`);
    lines.push(`; 공구 경로 크기: ${fmt(tempRx * 2)}x${fmt(tempRy * 2)}mm`);
    lines.push(`; 생성 일자: ${new Date().toISOString().slice(0,10)}`);
    lines.push(`; =============================================`);
    lines.push('');
    lines.push(`; --- 가공 모델 파라미터 ---`);
    lines.push(`; 스핀들 속도: ${rpm} RPM`);
    lines.push(`; 이송 속도: ${feedRate} mm/min`);
    lines.push(`; 진입 속도: ${plungeRate} mm/min`);
    lines.push(`; 1회 절입량(DOC): ${doc} mm`);
    lines.push(`; 헬리컬 램프 진입: ${config.enableRamping ? '적용 (Ramp)' : '미적용 (Plunge)'}`);
    lines.push(`; 안전 높이: ${safeZ} mm`);
    lines.push('');

    // ========== INIT ==========
    lines.push('G90 ; 절대 좌표계 지정');
    lines.push('G21 ; 밀리미터 단위 지정');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이 이동`);
    lines.push(`M3 S${rpm} ; 스핀들 회전 시작`);
    lines.push('G4 P3 ; 스핀들 안정화 대기 (3초)');
    lines.push('');

    // ========== PROFILE CUT WITH TABS ==========
    lines.push(`; ========== 공정 1: 타원 형상 관통 가공 (${isInner ? '내경' : '외경'} 가공 + 탭) ==========`);
    const innerToolRx = tempRx;
    const innerToolRy = tempRy;
    const tabCount = config.tabCount || 4;
    const tabAngles = [];
    for (let i = 0; i < tabCount; i++) {
      tabAngles.push((2 * Math.PI * i) / tabCount);
    }
    const avgR = (innerToolRx + innerToolRy) / 2;
    const tabArcHalf = (config.tabWidth / 2) / avgR;
    const fullDepth = config.materialThickness;
    const tabTopZ = -(fullDepth - config.tabHeight);

    // Roughing passes (leave finish allowance)
    const allowance = config.finishAllowance || 0;
    const roughRx = innerToolRx - allowance;
    const roughRy = innerToolRy - allowance;
    const outerZPasses = Math.ceil(fullDepth / doc);

    if (allowance > 0 && config.enableFinishPass) {
      lines.push('; --- 황삭 가공 (여유량 남김) ---');
    }

    for (let zPass = 1; zPass <= outerZPasses; zPass++) {
      const targetZ = -Math.min(zPass * doc, fullDepth);
      const startZ = -(zPass - 1) * doc;
      const rx = (allowance > 0 && config.enableFinishPass) ? roughRx : innerToolRx;
      const ry = (allowance > 0 && config.enableFinishPass) ? roughRy : innerToolRy;
      lines.push(`; --- 타원 가공 Z 패스 ${zPass}/${outerZPasses} (Z=${fmt(targetZ)}) ---`);

      const pts = [];
      const rampSteps = config.enableRamping ? Math.floor(numPts / 4) : 0;
      for (let i = 0; i <= numPts; i++) {
        const t = (2 * Math.PI * i) / numPts;
        const x = offsetX + rx * Math.cos(t);
        const y = offsetY + ry * Math.sin(t);

        let currentPtZ = targetZ;
        if (config.enableRamping && i < rampSteps) {
          currentPtZ = startZ + (targetZ - startZ) * (i / rampSteps);
        }

        const inTab = this.isInTab(t, tabAngles, tabArcHalf);
        const z = inTab ? Math.max(currentPtZ, tabTopZ) : currentPtZ;
        pts.push({ x, y, z });
      }

      lines.push(`G0 X${fmt(pts[0].x)} Y${fmt(pts[0].y)}`);
      lines.push(`G1 Z${fmt(pts[0].z)} F${plungeRate}`);

      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], prev = pts[i-1];
        if (Math.abs(p.z - prev.z) > 0.001) {
          lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)} F${feedRate * 0.7}`);
        } else {
          lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} F${feedRate}`);
        }
        addDist(p.x, p.y, p.z);
      }
      lines.push(`G0 Z${fmt(safeZ)}`);
    }

    // ========== FINISH PASS ==========
    if (config.enableFinishPass && allowance > 0) {
      lines.push('');
      lines.push('; ========== 공정 2: 타원 마감 정삭 가공 ==========');
      const finishFeed = Math.round(feedRate * 0.7);

      for (let zPass = 1; zPass <= outerZPasses; zPass++) {
        const targetZ = -Math.min(zPass * doc, fullDepth);
        const startZ = -(zPass - 1) * doc;
        lines.push(`; --- 정삭 가공 Z 패스 ${zPass}/${outerZPasses} (Z=${fmt(targetZ)}) ---`);

        const pts = [];
        const rampSteps = config.enableRamping ? Math.floor(numPts / 4) : 0;
        for (let i = 0; i <= numPts; i++) {
          const t = (2 * Math.PI * i) / numPts;
          const x = offsetX + innerToolRx * Math.cos(t);
          const y = offsetY + innerToolRy * Math.sin(t);

          let currentPtZ = targetZ;
          if (config.enableRamping && i < rampSteps) {
            currentPtZ = startZ + (targetZ - startZ) * (i / rampSteps);
          }

          const inTab = this.isInTab(t, tabAngles, tabArcHalf);
          const z = inTab ? Math.max(currentPtZ, tabTopZ) : currentPtZ;
          pts.push({ x, y, z });
        }

        lines.push(`G0 X${fmt(pts[0].x)} Y${fmt(pts[0].y)}`);
        lines.push(`G1 Z${fmt(pts[0].z)} F${plungeRate}`);

        for (let i = 1; i < pts.length; i++) {
          const p = pts[i], prev = pts[i-1];
          if (Math.abs(p.z - prev.z) > 0.001) {
            lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} Z${fmt(p.z)} F${finishFeed}`);
          } else {
            lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)} F${finishFeed}`);
          }
          addDist(p.x, p.y, p.z);
        }
        lines.push(`G0 Z${fmt(safeZ)}`);
      }
    }

    // ========== FOOTER ==========
    lines.push('');
    lines.push('; ========== 가공 완료 (END) ==========');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이로 Z축 후퇴`);
    lines.push('M5 ; 스핀들 정지');
    lines.push('G0 X0 Y0 ; 기계 원점으로 귀환');
    lines.push('M2 ; 프로그램 종료');

    // Estimate time (very rough)
    const feedTimeMin = totalDist / feedRate;
    const totalTimeMin = feedTimeMin + (outerZPasses * safeZ * 2 / 3000);

    return {
      gcode: lines.join('\n'),
      lines: lines.length,
      totalDistance: Math.round(totalDist),
      estimatedTime: totalTimeMin,
      templateWidth: config.width,
      templateHeight: config.height,
      params,
      isTemplate: true
    };
  }

  /**
   * Generate Nameplate Engraving G-code using opentype.js font path
   */
  generateNameplate(config, font, font2) {
    const params = this.calculateParams({
      cncModel: config.cncModel,
      toolDiameter: config.shankDiameter,
      toolFlutes: config.toolFlutes,
      woodType: config.woodType,
      depthPerPass: config.depthPerPass
    });
    const { rpm, feedRate, plungeRate, safeZ } = params;

    // Safety checks
    const thickness = config.thickness;
    const engraveDepth = config.engraveDepth;
    const shankDiam = config.shankDiameter;
    const tipRadius = config.tipRadius;
    const bitAngle = config.bitAngle;
    const fontSize = config.fontSize;

    // Calculate effective cut width of the V-bit at engraving depth
    const rad = bitAngle * Math.PI / 360; // theta / 2 in radians
    const cutWidth = 2 * engraveDepth * Math.tan(rad) + 2 * tipRadius;

    let safetyReport = {
      status: 'safe',
      statusText: '안전 (가공 가능)',
      details: `안전성 확인 완료: 각인 깊이(${engraveDepth}mm)가 소재 두께(${thickness}mm)에 비해 적절합니다. 안전하게 G-code를 가공할 수 있습니다.`
    };

    if (engraveDepth >= thickness) {
      safetyReport = {
        status: 'danger',
        statusText: '위험 (가공 차단됨)',
        details: `<strong>위험:</strong> 각인 깊이(${engraveDepth}mm)가 소재 두께(${thickness}mm)보다 깊거나 같습니다! 이대로 가공하면 공작물 전체가 관통되어 CNC 베드가 파손됩니다. 각인 깊이를 재료 두께보다 작게 조정하세요.`
      };
      return {
        error: '가공 불가: 각인 깊이가 소재 두께를 초과합니다.',
        safetyReport
      };
    } else if (engraveDepth > thickness * 0.5) {
      safetyReport = {
        status: 'warning',
        statusText: '주의 (공구 규격 경고)',
        details: `<strong>주의:</strong> 설정된 글자 크기(${fontSize}mm) 대비 각인 날의 유효 커팅 폭(${cutWidth.toFixed(2)}mm)이 다소 굵습니다. 글자 아웃라인이 겹치거나 세부 디테일이 날아갈 수 있으니, 더 날카로운 각인날(각도가 작거나 R이 작은 날)을 사용하거나 글자 크기를 키워 주세요.`
      };
    }

    // Engraving specific DOC override for V-bit tip safety
    const doc = config.depthPerPass !== undefined ? config.depthPerPass : Math.min(params.doc, 0.5);

    const lines = [];
    let totalDist = 0;
    let lastX = null, lastY = null, lastZ = null;

    const addDist = (x, y, z) => {
      if (lastX !== null) {
        const dx = x - lastX, dy = y - lastY, dz = (z || 0) - (lastZ || 0);
        totalDist += Math.sqrt(dx*dx + dy*dy + dz*dz);
      }
      lastX = x; lastY = y; lastZ = z || lastZ;
    };

    const fmt = (v) => v.toFixed(3);

    // Contour parser helper for dynamic multiple fonts and properties with letter spacing
    const getCncContoursForText = (text, fontObj, size, letterSpacingPercent, ox, oy) => {
      if (!text || !fontObj) return [];
      
      const scale = size / fontObj.unitsPerEm;
      const glyphs = fontObj.stringToGlyphs(text);
      const letterSpacing = (size * letterSpacingPercent) / 100;
      
      const testPath = new opentype.Path();
      let currentX = 0;
      
      glyphs.forEach(glyph => {
        const charPath = glyph.getPath(currentX, 0, size);
        testPath.commands.push(...charPath.commands);
        currentX += glyph.advanceWidth * scale + letterSpacing;
      });

      const bbox = testPath.getBoundingBox();

      // Center point in canvas coordinates (Y-down)
      const tx_c = (bbox.x1 + bbox.x2) / 2;
      const ty_c = (bbox.y1 + bbox.y2) / 2;

      // Helper to map canvas-space (Y-down) to CNC-space (Y-up, origin aware)
      const mapToCNC = (cx, cy) => {
        const relX = cx - tx_c;
        const relY = ty_c - cy; // Flip Y direction

        if (config.originPosition === 'center') {
          return {
            x: relX + ox,
            y: relY + oy
          };
        } else { // bottomleft
          return {
            x: (config.width / 2) + relX + ox,
            y: (config.height / 2) + relY + oy
          };
        }
      };

      const contours = [];
      let currentContour = [];
      let curX = 0, curY = 0;
      let startX = 0, startY = 0;

      testPath.commands.forEach(cmd => {
        if (cmd.type === 'M') {
          if (currentContour.length > 0) {
            contours.push(currentContour);
          }
          currentContour = [{ type: 'M', x: cmd.x, y: cmd.y }];
          startX = cmd.x;
          startY = cmd.y;
          curX = cmd.x;
          curY = cmd.y;
        } else if (cmd.type === 'L') {
          currentContour.push({ type: 'L', x: cmd.x, y: cmd.y });
          curX = cmd.x;
          curY = cmd.y;
        } else if (cmd.type === 'Q') {
          const segments = 8;
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const x = mt*mt*curX + 2*mt*t*cmd.x1 + t*t*cmd.x;
            const y = mt*mt*curY + 2*mt*t*cmd.y1 + t*t*cmd.y;
            currentContour.push({ type: 'L', x, y });
          }
          curX = cmd.x;
          curY = cmd.y;
        } else if (cmd.type === 'C') {
          const segments = 12;
          for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const x = mt*mt*mt*curX + 3*mt*mt*t*cmd.x1 + 3*mt*t*t*cmd.x2 + t*t*t*cmd.x;
            const y = mt*mt*mt*curY + 3*mt*mt*t*cmd.y1 + 3*mt*t*t*cmd.y2 + t*t*t*cmd.y;
            currentContour.push({ type: 'L', x, y });
          }
          curX = cmd.x;
          curY = cmd.y;
        } else if (cmd.type === 'Z') {
          currentContour.push({ type: 'L', x: startX, y: startY });
          curX = startX;
          curY = startY;
        }
      });

      if (currentContour.length > 0) {
        contours.push(currentContour);
      }

      // Convert all contours to CNC space
      return contours.map(contour => {
        return contour.map(cmd => {
          const pt = mapToCNC(cmd.x, cmd.y);
          return {
            type: cmd.type,
            x: pt.x,
            y: pt.y
          };
        });
      });
    };

    const getCncContoursByCharacter = (text, fontObj, size, letterSpacingPercent, ox, oy) => {
      if (!text || !fontObj) return [];
      
      const scale = size / fontObj.unitsPerEm;
      const glyphs = fontObj.stringToGlyphs(text);
      const letterSpacing = (size * letterSpacingPercent) / 100;

      // Build entire composite path with spacing to calculate exact visual center
      const entirePath = new opentype.Path();
      let tempX = 0;
      glyphs.forEach(glyph => {
        const charPath = glyph.getPath(tempX, 0, size);
        entirePath.commands.push(...charPath.commands);
        tempX += glyph.advanceWidth * scale + letterSpacing;
      });

      const bbox = entirePath.getBoundingBox();
      const tx_c = (bbox.x1 + bbox.x2) / 2;
      const ty_c = (bbox.y1 + bbox.y2) / 2;

      const mapToCNC = (cx, cy) => {
        const relX = cx - tx_c;
        const relY = ty_c - cy; // Flip Y direction

        if (config.originPosition === 'center') {
          return {
            x: relX + ox,
            y: relY + oy
          };
        } else { // bottomleft
          return {
            x: (config.width / 2) + relX + ox,
            y: (config.height / 2) + relY + oy
          };
        }
      };

      let currentX = 0;
      const characterDataList = [];

      glyphs.forEach((glyph, index) => {
        // Space doesn't have a visible path, but it advances currentX
        const charPath = glyph.getPath(currentX, 0, size);
        currentX += glyph.advanceWidth * scale + letterSpacing;

        // Parse commands into contours for this character
        const contours = [];
        let currentContour = [];
        let curX = 0, curY = 0;
        let startX = 0, startY = 0;

        charPath.commands.forEach(cmd => {
          if (cmd.type === 'M') {
            if (currentContour.length > 0) {
              contours.push(currentContour);
            }
            currentContour = [{ type: 'M', x: cmd.x, y: cmd.y }];
            startX = cmd.x;
            startY = cmd.y;
            curX = cmd.x;
            curY = cmd.y;
          } else if (cmd.type === 'L') {
            currentContour.push({ type: 'L', x: cmd.x, y: cmd.y });
            curX = cmd.x;
            curY = cmd.y;
          } else if (cmd.type === 'Q') {
            const segments = 8;
            for (let i = 1; i <= segments; i++) {
              const t = i / segments;
              const mt = 1 - t;
              const x = mt*mt*curX + 2*mt*t*cmd.x1 + t*t*cmd.x;
              const y = mt*mt*curY + 2*mt*t*cmd.y1 + t*t*cmd.y;
              currentContour.push({ type: 'L', x, y });
            }
            curX = cmd.x;
            curY = cmd.y;
          } else if (cmd.type === 'C') {
            const segments = 12;
            for (let i = 1; i <= segments; i++) {
              const t = i / segments;
              const mt = 1 - t;
              const x = mt*mt*mt*curX + 3*mt*mt*t*cmd.x1 + 3*mt*t*t*cmd.x2 + t*t*t*cmd.x;
              const y = mt*mt*mt*curY + 3*mt*mt*t*cmd.y1 + 3*mt*t*t*cmd.y2 + t*t*t*cmd.y;
              currentContour.push({ type: 'L', x, y });
            }
            curX = cmd.x;
            curY = cmd.y;
          } else if (cmd.type === 'Z') {
            currentContour.push({ type: 'L', x: startX, y: startY });
            curX = startX;
            curY = startY;
          }
        });

        if (currentContour.length > 0) {
          contours.push(currentContour);
        }

        if (contours.length > 0) {
          // Convert contours to CNC space
          const cncContours = contours.map(contour => {
            return contour.map(cmd => {
              const pt = mapToCNC(cmd.x, cmd.y);
              return {
                type: cmd.type,
                x: pt.x,
                y: pt.y
              };
            });
          });

          characterDataList.push({
            char: glyph.unicode ? String.fromCharCode(glyph.unicode) : `glyph_${index}`,
            contours: cncContours
          });
        }
      });

      return characterDataList;
    };

    // Gather CNC contours & hatches for all enabled text tracks
    let cncContours = [];
    let hatchSegments = [];
    
    // Stepover pitch (V-Bit effective width * stepoverPercent / 100)
    const stepover = cutWidth * (config.stepoverPercent / 100);

    const generateHatches = (contoursList) => {
      const segments = [];
      let minY = Infinity, maxY = -Infinity;
      contoursList.forEach(contour => {
        contour.forEach(pt => {
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        });
      });
      
      let lineIdx = 0;
      if (minY !== Infinity && maxY !== -Infinity && stepover > 0.05) {
        for (let y = minY + stepover / 2; y < maxY; y += stepover) {
          const intersections = [];
          contoursList.forEach(contour => {
            const len = contour.length;
            if (len < 3) return;
            for (let i = 0; i < len; i++) {
              const p1 = contour[i];
              const p2 = contour[(i + 1) % len];
              const y1 = p1.y;
              const y2 = p2.y;
              const cond1 = (y1 <= y && y < y2);
              const cond2 = (y2 <= y && y < y1);
              if (cond1 || cond2) {
                if (y1 !== y2) {
                  const t = (y - y1) / (y2 - y1);
                  const x = p1.x + t * (p2.x - p1.x);
                  intersections.push(x);
                }
              }
            }
          });
          intersections.sort((a, b) => a - b);
          
          const lineSegments = [];
          for (let i = 0; i < intersections.length - 1; i += 2) {
            const x1 = intersections[i];
            const x2 = intersections[i + 1];
            if (Math.abs(x2 - x1) >= 0.02) {
              lineSegments.push({ x1, x2 });
            }
          }

          // Zig-zag hatch: reverse scanning direction on odd lines
          if (lineIdx % 2 === 1) {
            lineSegments.reverse();
            lineSegments.forEach(seg => {
              segments.push({
                x1: seg.x2,
                y1: y,
                x2: seg.x1,
                y2: y
              });
            });
          } else {
            lineSegments.forEach(seg => {
              segments.push({
                x1: seg.x1,
                y1: y,
                x2: seg.x2,
                y2: y
              });
            });
          }
          lineIdx++;
        }
      }
      return segments;
    };

    if (config.text && font) {
      const textContours = getCncContoursForText(config.text, font, config.fontSize, config.letterSpacing, config.offsetX, config.offsetY);
      cncContours = cncContours.concat(textContours);
      if (config.engraveMode === 'infill') {
        hatchSegments = hatchSegments.concat(generateHatches(textContours));
      }
    }
    if (config.enableText2 && config.text2 && (font2 || config.font2)) {
      const activeF2 = font2 || config.font2;
      const text2Contours = getCncContoursForText(config.text2, activeF2, config.fontSize2, config.letterSpacing2, config.offsetX2, config.offsetY2);
      cncContours = cncContours.concat(text2Contours);
      if (config.engraveMode === 'infill') {
        hatchSegments = hatchSegments.concat(generateHatches(text2Contours));
      }
    }

    // ========== HEADER ==========
    lines.push(`; =============================================`);
    lines.push(`; 명패 각인 가공 — ${config.width}×${config.height}mm`);
    lines.push(`; 각인 문구 1: "${config.text}" (${config.fontSize}mm)`);
    if (config.enableText2 && config.text2) {
      lines.push(`; 각인 문구 2: "${config.text2}" (${config.fontSize2}mm)`);
    }
    lines.push(`; Generated by STUDIOHYUN Cam Tool`);
    lines.push(`; 가공 장비: ${params.spec.name}`);
    lines.push(`; 가공 소재: ${config.woodType} / 두께 ${config.thickness}mm`);
    lines.push(`; 사용 공구: 섕크 Ø${shankDiam}mm / 날끝 R${tipRadius}mm / 각도 ${bitAngle}° 조각용 Conical V-Bit`);
    lines.push(`; 생성 일자: ${new Date().toISOString().slice(0,10)}`);
    lines.push(`; =============================================`);
    lines.push('');
    lines.push(`; --- 가공 모델 파라미터 ---`);
    lines.push(`; 스핀들 속도: ${rpm} RPM`);
    lines.push(`; 이송 속도: ${feedRate} mm/min`);
    lines.push(`; 진입 속도: ${plungeRate} mm/min`);
    lines.push(`; 각인 가공 깊이: ${engraveDepth} mm (최대 깊이)`);
    lines.push(`; 1회 절입량(DOC): ${doc} mm`);
    lines.push(`; 헬리컬 램프 진입: ${config.enableRamping ? '적용 (Ramp)' : '미적용 (Plunge)'}`);
    lines.push(`; 안전 높이: ${safeZ} mm`);
    lines.push('');

    // ========== INIT ==========
    lines.push('G90 ; 절대 좌표계 지정');
    lines.push('G21 ; 밀리미터 단위 지정');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이 이동`);
    lines.push(`M3 S${rpm} ; 스핀들 회전 시작`);
    lines.push('G4 P3 ; 스핀들 안정화 대기 (3초)');
    lines.push('');

    // ========== ENGRAVING OPERATIONS (Multi Z-passes if needed) ==========
    const numZPasses = Math.ceil(engraveDepth / doc);
    lines.push(`; ========== 공정: 텍스트 각인 가공 (${numZPasses}회 분할 가공) ==========`);

    if (config.letterByLetter && (config.text || config.text2)) {
      // Character-by-character engraving (Optimized travel)
      const allCharGroups = [];
      if (config.text && font) {
        allCharGroups.push(...getCncContoursByCharacter(config.text, font, config.fontSize, config.letterSpacing, config.offsetX, config.offsetY));
      }
      if (config.enableText2 && config.text2 && (font2 || config.font2)) {
        const activeF2 = font2 || config.font2;
        allCharGroups.push(...getCncContoursByCharacter(config.text2, activeF2, config.fontSize2, config.letterSpacing2, config.offsetX2, config.offsetY2));
      }

      allCharGroups.forEach((group, charIdx) => {
        lines.push(`; --- 각인 글자: "${group.char}" (${charIdx + 1}/${allCharGroups.length}) ---`);
        
        let charHatches = [];
        if (config.engraveMode === 'infill') {
          charHatches = generateHatches(group.contours);
        }

        for (let pass = 1; pass <= numZPasses; pass++) {
          const currentZ = -Math.min(pass * doc, engraveDepth);
          const startZ = -(pass - 1) * doc;
          lines.push(`; --- 글자 Z 패스 ${pass}/${numZPasses} (Z=${fmt(currentZ)}) ---`);

          // 1. Infill Hatching (Zig-zag, minimal Z lifts)
          if (config.engraveMode === 'infill' && charHatches.length > 0) {
            lines.push('; 내부 채움 해칭 (Hatch Infill)');
            let hasPlunged = false;
            let lastX = null, lastY = null;

            charHatches.forEach((segment, idx) => {
              let dist = Infinity;
              if (lastX !== null && lastY !== null) {
                dist = Math.sqrt((segment.x1 - lastX)**2 + (segment.y1 - lastY)**2);
              }

              const threshold = stepover * 1.8;
              if (dist <= threshold && hasPlunged) {
                // Sidestep directly at cutting depth
                lines.push(`G1 X${fmt(segment.x1)} Y${fmt(segment.y1)} F${feedRate}`);
                addDist(segment.x1, segment.y1, currentZ);
                lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} F${feedRate}`);
                addDist(segment.x2, segment.y2, currentZ);
              } else {
                // Retract, fly, and plunge
                if (hasPlunged) {
                  lines.push(`G0 Z${fmt(safeZ)}`);
                }
                lines.push(`G0 X${fmt(segment.x1)} Y${fmt(segment.y1)}`);
                if (config.enableRamping) {
                  lines.push(`G1 Z${fmt(startZ)} F${plungeRate}`);
                  addDist(segment.x1, segment.y1, startZ);
                  lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} Z${fmt(currentZ)} F${feedRate}`);
                  addDist(segment.x2, segment.y2, currentZ);
                } else {
                  lines.push(`G1 Z${fmt(currentZ)} F${plungeRate}`);
                  addDist(segment.x1, segment.y1, currentZ);
                  lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} F${feedRate}`);
                  addDist(segment.x2, segment.y2, currentZ);
                }
                hasPlunged = true;
              }

              lastX = segment.x2;
              lastY = segment.y2;
            });

            if (hasPlunged) {
              lines.push(`G0 Z${fmt(safeZ)}`);
            }
          }

          // 2. Contour Clean / Trace Pass
          lines.push('; 아웃라인 외각 조각 (Outline Contour)');
          group.contours.forEach((contour, idx) => {
            if (contour.length === 0) return;
            lines.push(`; 윤곽선 ${idx + 1}`);

            let lastX = null;
            let lastY = null;
            const rampSteps = config.enableRamping ? Math.min(contour.length - 1, 10) : 0;

            contour.forEach((pt, ptIdx) => {
              const fx = fmt(pt.x);
              const fy = fmt(pt.y);
              if (pt.type === 'M') {
                lines.push(`G0 Z${fmt(safeZ)}`);
                lines.push(`G0 X${fx} Y${fy}`);
                lines.push(`G1 Z${fmt(startZ)} F${plungeRate}`);
                addDist(pt.x, pt.y, startZ);
                lastX = pt.x;
                lastY = pt.y;
              } else {
                if (fx !== fmt(lastX) || fy !== fmt(lastY)) {
                  let zVal = currentZ;
                  if (config.enableRamping && ptIdx <= rampSteps) {
                    zVal = startZ + (currentZ - startZ) * (ptIdx / rampSteps);
                  }
                  lines.push(`G1 X${fx} Y${fy} Z${fmt(zVal)} F${feedRate}`);
                  addDist(pt.x, pt.y, zVal);
                  lastX = pt.x;
                  lastY = pt.y;
                }
              }
            });
          });
          lines.push(`G0 Z${fmt(safeZ)}`);
        }
        lines.push('');
      });
    } else {
      // Original Layer-by-layer engraving (across all text together)
      for (let pass = 1; pass <= numZPasses; pass++) {
        const currentZ = -Math.min(pass * doc, engraveDepth);
        const startZ = -(pass - 1) * doc;
        lines.push(`; --- 전체 텍스트 Z 패스 ${pass}/${numZPasses} (Z=${fmt(currentZ)}) ---`);

        // 1. Infill Hatching (Zig-zag, minimal Z lifts)
        if (config.engraveMode === 'infill' && hatchSegments.length > 0) {
          lines.push('; 내부 채움 해칭 (Hatch Infill)');
          let hasPlunged = false;
          let lastX = null, lastY = null;

          hatchSegments.forEach((segment, idx) => {
            let dist = Infinity;
            if (lastX !== null && lastY !== null) {
              dist = Math.sqrt((segment.x1 - lastX)**2 + (segment.y1 - lastY)**2);
            }

            const threshold = stepover * 1.8;
            if (dist <= threshold && hasPlunged) {
              // Sidestep directly at cutting depth
              lines.push(`G1 X${fmt(segment.x1)} Y${fmt(segment.y1)} F${feedRate}`);
              addDist(segment.x1, segment.y1, currentZ);
              lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} F${feedRate}`);
              addDist(segment.x2, segment.y2, currentZ);
            } else {
              // Retract, fly, and plunge
              if (hasPlunged) {
                lines.push(`G0 Z${fmt(safeZ)}`);
              }
              lines.push(`G0 X${fmt(segment.x1)} Y${fmt(segment.y1)}`);
              if (config.enableRamping) {
                lines.push(`G1 Z${fmt(startZ)} F${plungeRate}`);
                addDist(segment.x1, segment.y1, startZ);
                lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} Z${fmt(currentZ)} F${feedRate}`);
                addDist(segment.x2, segment.y2, currentZ);
              } else {
                lines.push(`G1 Z${fmt(currentZ)} F${plungeRate}`);
                addDist(segment.x1, segment.y1, currentZ);
                lines.push(`G1 X${fmt(segment.x2)} Y${fmt(segment.y2)} F${feedRate}`);
                addDist(segment.x2, segment.y2, currentZ);
              }
              hasPlunged = true;
            }

            lastX = segment.x2;
            lastY = segment.y2;
          });

          if (hasPlunged) {
            lines.push(`G0 Z${fmt(safeZ)}`);
          }
        }

        // 2. Contour Clean / Trace Pass
        lines.push('; 아웃라인 외각 조각 (Outline Contour)');
        cncContours.forEach((contour, idx) => {
          if (contour.length === 0) return;
          lines.push(`; 윤곽선 ${idx + 1}`);

          let lastX = null;
          let lastY = null;
          const rampSteps = config.enableRamping ? Math.min(contour.length - 1, 10) : 0;

          contour.forEach((pt, ptIdx) => {
            const fx = fmt(pt.x);
            const fy = fmt(pt.y);
            if (pt.type === 'M') {
              // Retract, move rapidly to start, and plunge
              lines.push(`G0 Z${fmt(safeZ)}`);
              lines.push(`G0 X${fx} Y${fy}`);
              lines.push(`G1 Z${fmt(startZ)} F${plungeRate}`);
              addDist(pt.x, pt.y, startZ);
              lastX = pt.x;
              lastY = pt.y;
            } else {
              // Filter out duplicate or zero-length moves (same coordinates under formatting)
              if (fx !== fmt(lastX) || fy !== fmt(lastY)) {
                let zVal = currentZ;
                if (config.enableRamping && ptIdx <= rampSteps) {
                  zVal = startZ + (currentZ - startZ) * (ptIdx / rampSteps);
                }
                lines.push(`G1 X${fx} Y${fy} Z${fmt(zVal)} F${feedRate}`);
                addDist(pt.x, pt.y, zVal);
                lastX = pt.x;
                lastY = pt.y;
              }
            }
          });
        });
        lines.push(`G0 Z${fmt(safeZ)}`);
        lines.push('');
      }
    }

    // ========== FOOTER ==========
    lines.push('; ========== 가공 완료 (END) ==========');
    lines.push(`G0 Z${fmt(safeZ)} ; 안전 높이로 Z축 후퇴`);
    lines.push('M5 ; 스핀들 정지');
    lines.push('G0 X0 Y0 ; 기계 원점으로 귀환');
    lines.push('M2 ; 프로그램 종료');

    // Estimate time (feed travel + simple rapid overhead)
    const feedTimeMin = totalDist / feedRate;
    const rapidTimeMin = (cncContours.length * numZPasses * safeZ * 2 / 3000);
    const totalTimeMin = feedTimeMin + rapidTimeMin;

    return {
      gcode: lines.join('\n'),
      lines: lines.length,
      totalDistance: Math.round(totalDist),
      estimatedTime: totalTimeMin,
      safetyReport,
      params
    };
  }
}

// Export for use
window.GCodeGenerator = GCodeGenerator;
