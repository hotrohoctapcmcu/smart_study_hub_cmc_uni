export function aiText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.toWellFormed().replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
export const hasAIText = value => typeof value === 'string' && value.replace(/\p{Default_Ignorable_Code_Point}/gu, '').trim().length > 0;
