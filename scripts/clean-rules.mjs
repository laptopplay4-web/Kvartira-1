import fs from 'fs';

const files = [
  ['.cursor/rules/PROJECT_SPEC.md', 'project_spec'],
  ['.cursor/rules/DESIGN_SYSTEM.md', 'design_system'],
  ['.cursor/rules/DEVELOPMENT_RULES.md', 'dev_rules'],
];

for (const [filePath, varName] of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const marker = `${varName} = r"""`;
  const start = content.indexOf(marker);
  if (start === -1) {
    console.log(`Skip ${filePath} — already clean`);
    continue;
  }
  const bodyStart = start + marker.length;
  const end = content.indexOf('"""', bodyStart);
  if (end === -1) throw new Error(`No closing quote in ${filePath}`);
  fs.writeFileSync(filePath, content.slice(bodyStart, end), 'utf8');
  console.log(`Cleaned ${filePath}`);
}
