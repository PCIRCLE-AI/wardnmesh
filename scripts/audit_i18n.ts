import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'apps/web/src/messages');
const sourceLocale = 'en.json';

type JsonObject = { [key: string]: any };

function getKeys(obj: JsonObject, prefix = ''): string[] {
  return Object.keys(obj).reduce((acc: string[], key) => {
    const value = obj[key];
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [...acc, ...getKeys(value, newPrefix)];
    }
    return [...acc, newPrefix];
  }, []);
}

function audit() {
  console.log('🔍 Starting i18n Audit...');
  
  const sourcePath = path.join(localesDir, sourceLocale);
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source locale file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  const sourceKeys = new Set(getKeys(sourceContent));
  console.log(`📝 Source (${sourceLocale}) has ${sourceKeys.size} keys.`);

  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== sourceLocale);
  let hasErrors = false;

  files.forEach(file => {
    const filePath = path.join(localesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const keys = new Set(getKeys(content));
    
    const missing = [...sourceKeys].filter(k => !keys.has(k));
    
    if (missing.length > 0) {
      console.error(`\n❌ ${file} is missing ${missing.length} keys:`);
      missing.forEach(k => console.error(`   - ${k}`));
      hasErrors = true;
    } else {
      console.log(`✅ ${file} matches all keys.`);
    }
  });

  if (hasErrors) {
    console.log('\n⚠️ Audit failed. Please fix missing keys.');
    process.exit(1);
  } else {
    console.log('\n✨ Audit passed! All locales are in sync.');
  }
}

audit();
