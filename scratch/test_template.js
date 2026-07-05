const fs = require('fs');
const path = require('path');

// Simulate the window object for browser scripts
global.window = {};

const generatorFilePath = path.join('/Volumes/Studio Hyun/Dev_Cam Program/gcode-generator.js');
const generatorCode = fs.readFileSync(generatorFilePath, 'utf8');
eval(generatorCode);

const GCodeGenerator = window.GCodeGenerator;
const generator = new GCodeGenerator();

// Let's test the simplified Template (Gada) configuration
const insideConfig = {
  isTemplate:        true,
  width:             300,
  height:            200,
  cutType:           'inner',
  materialThickness: 15.0,
  toolDiameter:      6.0,
  toolFlutes:        2,
  cncModel:          'ttc450pro',
  tabCount:          4,
  tabWidth:          6.0,
  tabHeight:         2.0,
  finishAllowance:   0.3,
  safeZ:             5.0,
  woodType:          'softwood',
  originPosition:    'bottomleft',
  enableFinishPass:  true,
  depthPerPass:      2.0,    // 1회 절입량
  enableRamping:     true    // 램프 진입
};

console.log('--- Gada Template G-code Generation Test: Inside Cut ---');
const insideResult = generator.generateTemplate(insideConfig);

if (insideResult.error) {
  console.error(`[ERROR] Gada Inside G-code generation failed: ${insideResult.error}`);
  process.exit(1);
}

console.log('G-code Header Preview:');
console.log(insideResult.gcode.split('\n').slice(0, 15).join('\n'));

console.log('\nVerifying Inside Cut toolpath dimensions...');
const expectedInsideRx = (insideConfig.width / 2) - (insideConfig.toolDiameter / 2);
const expectedInsideRy = (insideConfig.height / 2) - (insideConfig.toolDiameter / 2);
const expectedInsideW = expectedInsideRx * 2;
const expectedInsideH = expectedInsideRy * 2;

console.log(`Expected toolpath width: ${expectedInsideW} mm`);
console.log(`Expected toolpath height: ${expectedInsideH} mm`);

const insideHeaderContainsDim = insideResult.gcode.includes(`; 공구 경로 크기: ${expectedInsideW.toFixed(3)}x${expectedInsideH.toFixed(3)}mm`);
if (insideHeaderContainsDim) {
  console.log('[SUCCESS] Inside Cut toolpath dimensions in G-code header match expected.');
} else {
  console.error('[FAILURE] Inside Cut toolpath dimensions in G-code header do not match.');
  process.exit(1);
}

// Verify Korean comments
console.log('\nVerifying Korean comments...');
const hasKoreanComment = insideResult.gcode.includes('; 절대 좌표계 지정') && insideResult.gcode.includes('공정 1: 타원 형상 관통 가공');
if (hasKoreanComment) {
  console.log('[SUCCESS] Korean comments are present in the G-code.');
} else {
  console.error('[FAILURE] Korean comments are missing in the G-code.');
  process.exit(1);
}

// Verify Ramping (Z slope interpolation in G1 commands)
console.log('\nVerifying Ramping coordinates...');
const lines = insideResult.gcode.split('\n');
let foundRampingMove = false;
for (const line of lines) {
  // Look for lines containing G1 with X, Y, and Z coords (interpolation)
  if (line.startsWith('G1') && line.includes('X') && line.includes('Y') && line.includes('Z-')) {
    console.log(`Found ramping instruction: ${line}`);
    foundRampingMove = true;
    break;
  }
}

if (foundRampingMove) {
  console.log('[SUCCESS] Ramping G1 moves are present.');
} else {
  console.error('[FAILURE] No ramping moves found in the G-code.');
  process.exit(1);
}

// Scenario 2: Outside Cut (외경 가공)
const outsideConfig = {
  ...insideConfig,
  cutType: 'outer'
};

console.log('\n--- Gada Template G-code Generation Test: Outside Cut ---');
const outsideResult = generator.generateTemplate(outsideConfig);

if (outsideResult.error) {
  console.error(`[ERROR] Gada Outside G-code generation failed: ${outsideResult.error}`);
  process.exit(1);
}

console.log('\nVerifying Outside Cut toolpath dimensions...');
const expectedOutsideRx = (outsideConfig.width / 2) + (outsideConfig.toolDiameter / 2);
const expectedOutsideRy = (outsideConfig.height / 2) + (outsideConfig.toolDiameter / 2);
const expectedOutsideW = expectedOutsideRx * 2;
const expectedOutsideH = expectedOutsideRy * 2;

console.log(`Expected toolpath width: ${expectedOutsideW} mm`);
console.log(`Expected toolpath height: ${expectedOutsideH} mm`);

const outsideHeaderContainsDim = outsideResult.gcode.includes(`; 공구 경로 크기: ${expectedOutsideW.toFixed(3)}x${expectedOutsideH.toFixed(3)}mm`);
if (outsideHeaderContainsDim) {
  console.log('[SUCCESS] Outside Cut toolpath dimensions in G-code header match expected.');
} else {
  console.error('[FAILURE] Outside Cut toolpath dimensions in G-code header do not match.');
  process.exit(1);
}

console.log('\n[SUCCESS] All tests passed.');
process.exit(0);
