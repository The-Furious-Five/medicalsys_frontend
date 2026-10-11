import { describe, expect, it } from 'vitest';
import { columnName, crc32, workbook } from './xlsx';

/** Lee las entradas de un ZIP sin compresión, comprobando la firma y el CRC de cada una. */
function entries(zip: Uint8Array): Map<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const found = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = decoder.decode(zip.subarray(offset + 30, offset + 30 + nameLength));
    const data = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    expect(crc32(data), `CRC de ${name}`).toBe(crc);
    found.set(name, decoder.decode(data));
    offset += 30 + nameLength + size;
  }
  // Tras los archivos viene el directorio central, que es lo que lee Excel.
  expect(view.getUint32(offset, true)).toBe(0x02014b50);
  return found;
}

describe('libro de Excel', () => {
  it('es un ZIP válido con las partes que exige el formato', () => {
    const files = entries(
      workbook([
        {
          name: 'Matriz',
          rows: [
            ['Permiso', 'PHYSICIAN'],
            ['clinical.encounter.sign', 'X'],
          ],
        },
        { name: 'Roles', rows: [['Rol'], ['PHYSICIAN']] },
      ]),
    );

    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Roles" sheetId="2" r:id="rId2"/>');
    expect(files.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
  });

  it('guarda cada celda como texto, escapado y sin caracteres que dañen el libro', () => {
    const files = entries(
      workbook([{ name: 'Matriz', rows: [['Módulo'], ['<b>=1+1\u0007</b>']] }]),
    );
    const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';

    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Módulo</t>');
    // Texto en línea: `=1+1` no se evalúa. El carácter de control desaparece.
    expect(sheet).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">&lt;b&gt;=1+1&lt;/b&gt;</t>',
    );
  });

  it('nombra las columnas como Excel', () => {
    expect([0, 25, 26, 27, 701].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
  });
});
