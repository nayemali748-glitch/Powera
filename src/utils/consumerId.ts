export function cleanAndNormalizeConsumerId(consumerId: any): string {
  if (!consumerId) return '';
  let str = String(consumerId).trim();
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  for (let i = 0; i < bengaliDigits.length; i++) {
    str = str.replaceAll(bengaliDigits[i], i.toString());
  }
  return str
    .replace(/^(PWR-DIS-|TASK-DISC-|SUB-DISC-|PWR-|TASK-|DISC-|CON-)/i, '')
    .replace(/\.0+$/, '')
    .replace(/[, \-_]/g, '')
    .trim();
}
