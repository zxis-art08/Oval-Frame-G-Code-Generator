const fs = require('fs');
const path = require('path');

// Simulate the window object for browser scripts
global.window = {};

const generatorFilePath = path.join('/Volumes/Studio Hyun/Dev_Cam Program/gcode-generator.js');
const generatorCode = fs.readFileSync(generatorFilePath, 'utf8');
eval(generatorCode);

const GCodeGenerator = window.GCodeGenerator;
const generator = new GCodeGenerator();

// Let's create a test preset to simulate user configurations
// Inner width should be = 300 - 2 * 20 = 260 mm
// Inner height should be = 400 - 2 * 20 = 360 mm
// Gada calculated width with +11mm offset should be = 260 + 11 = 271 mm
// Gada calculated height with +11mm offset should be = 360 + 11 = 371 mm
const testTemplateConfig = {
  isTemplate:        true,
  ovalWidth:         300,
  ovalHeight:        400,
  frameWidth:        20,
  rabbetWidth:       5.0,
  tmplOffset:        11.0,
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
  enableFinishPass:  true
};

console.log('--- Gada Template G-code Generation Test ---');
const result = generator.generateTemplate(testTemplateConfig);

if (result.error) {
  console.error(`[ERROR] Gada G-code generation failed: ${result.error}`);
  process.exit(1);
}

console.log('G-code Header Preview:');
console.log(result.gcode.split('\n').slice(0, 15).join('\n'));

console.log('\nVerifying calculations...');
const innerRx = (testTemplateConfig.ovalWidth / 2) - testTemplateConfig.frameWidth;
const innerRy = (testTemplateConfig.ovalHeight / 2) - testTemplateConfig.frameWidth;
const expectedW = (innerRx + testTemplateConfig.tmplOffset / 2) * 2;
const expectedH = (innerRy + testTemplateConfig.tmplOffset / 2) * 2;

console.log(`Expected Glass Gada width: ${expectedW} mm`);
console.log(`Expected Glass Gada height: ${expectedH} mm`);

// Check if header contains the expected dimension
const headerContainsDim = result.gcode.includes(`Glass Cutting Template (Gada) — ${expectedW.toFixed(3)}×${expectedH.toFixed(3)}mm`);
if (headerContainsDim) {
  console.log('[SUCCESS] Dimension in G-code header matches expected calculation.');
} else {
  console.error('[FAILURE] Dimension in G-code header does not match expected calculation.');
  process.exit(1);
}

// Let's run a calculation test inside calculateParams
const params = generator.calculateParams(testTemplateConfig);
console.log('Process Parameters:', params);

console.log('[SUCCESS] All tests passed.');
process.exit(0);
