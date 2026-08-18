import {
  getItemNumber,
  resolveSourceType,
  resolveCategory,
  resolveBrand,
  detectCodePrefixes,
  buildSummary,
  buildColumns,
  cellValue,
} from './inventoryUtils';

// 產生一列來源資料（欄位索引對齊真實來源檔）
const makeRow = (code, name, inventory, { price = 900, year = 2027, size = '356' } = {}) => {
  const row = [];
  row[0] = code;
  row[1] = name;
  row[11] = inventory;
  row[12] = price;
  row[13] = year;
  row[15] = size;
  return { data: row };
};
const makeTable = (name, rows) => ({ name, dataRows: rows });

describe('getItemNumber', () => {
  it('剛好兩個 - 才取：SG 前 12、其餘前 13', () => {
    expect(getItemNumber('SG240816-001-01')).toBe('SG240816-001'); // SG 取前 12
    expect(getItemNumber('4000016-0001U-356')).toBe('4000016-0001U'); // 其餘取前 13
  });
  it('不是兩個 - 一律留白', () => {
    expect(getItemNumber('2023GWP01-F')).toBe('');
    expect(getItemNumber('X0005')).toBe('');
  });
});

describe('resolveSourceType', () => {
  it('展威麗嬰房(平台總倉) → 展威（需先於平台判斷）', () => {
    expect(resolveSourceType('展威麗嬰房(平台總倉)')).toBe('展威');
  });
  it('展宇麗嬰(平台總倉) → 平台', () => {
    expect(resolveSourceType('展宇麗嬰(平台總倉)')).toBe('平台');
  });
  it('哈瓦仕電商倉 → 官網；未知 → 總倉', () => {
    expect(resolveSourceType('展宇麗嬰(哈瓦仕電商倉)')).toBe('官網');
    expect(resolveSourceType('展宇麗嬰房總倉')).toBe('總倉');
  });
});

describe('resolveCategory', () => {
  const warehouseMapping = { '展宇麗嬰房總倉': '總倉', 'A倉': '平台' };
  it('沒有規則時用倉庫對應', () => {
    expect(resolveCategory('4000016-1', 'A倉', warehouseMapping, [])).toBe('平台');
  });
  it('凌駕規則命中 → 整列改用貨號庫別，不管來自哪個倉庫', () => {
    const rules = [{ prefix: 'S', category: '總倉', override: true }];
    expect(resolveCategory('SG2024-1', 'A倉', warehouseMapping, rules)).toBe('總倉');
  });
  it('未勾凌駕的規則不生效', () => {
    const rules = [{ prefix: 'S', category: '總倉', override: false }];
    expect(resolveCategory('SG2024-1', 'A倉', warehouseMapping, rules)).toBe('平台');
  });
  it('多規則命中取最長前綴', () => {
    const rules = [
      { prefix: '4', category: '官網', override: true },
      { prefix: '4000016', category: 'ELLE', override: true },
    ];
    expect(resolveCategory('4000016-0001U-356', 'A倉', warehouseMapping, rules)).toBe('ELLE');
  });
});

describe('resolveBrand', () => {
  const rules = [
    { prefix: '4', brand: '麗嬰' },
    { prefix: 'HV', brand: '哈瓦仕' },
  ];
  it('最長前綴命中', () => {
    expect(resolveBrand('HV22006-0000-F', rules)).toBe('哈瓦仕');
    expect(resolveBrand('4000016-0001U-356', rules)).toBe('麗嬰');
  });
  it('無命中留白', () => {
    expect(resolveBrand('X0005', rules)).toBe('');
  });
});

describe('detectCodePrefixes', () => {
  it('列出所有貨號開頭字元並排序', () => {
    const tables = [
      makeTable('A倉', [makeRow('4000016-0001U-356', 'Color', 1), makeRow('SG2024-1', 'x', 1)]),
      makeTable('B倉', [makeRow('X0005', 'x', 1), makeRow('4000016-0090U-356', 'Color', 1)]),
    ];
    expect(detectCodePrefixes(tables)).toEqual(['4', 'S', 'X']);
  });
});

describe('buildSummary', () => {
  // 對照真實檔的關鍵列：4000016-0001U-356 在 總倉40/官網19/平台33/展威1
  const tables = [
    makeTable('展宇麗嬰房總倉', [makeRow('4000016-0001U-356', 'Color', 40)]),
    makeTable('展宇麗嬰(哈瓦仕電商倉)', [makeRow('4000016-0001U-356', 'Color', 19)]),
    makeTable('展宇麗嬰(平台總倉)', [makeRow('4000016-0001U-356', 'Color', 33)]),
    makeTable('展威麗嬰房(平台總倉)', [makeRow('4000016-0001U-356', 'Color', 1)]),
  ];
  const warehouseMapping = {
    '展宇麗嬰房總倉': '總倉',
    '展宇麗嬰(哈瓦仕電商倉)': '官網',
    '展宇麗嬰(平台總倉)': '平台',
    '展威麗嬰房(平台總倉)': '展威',
  };

  it('依倉庫對應把可售量落到各庫別欄', () => {
    const [item] = buildSummary(tables, { warehouseMapping });
    expect(item).toMatchObject({ 總倉: 40, 官網: 19, 平台: 33, 展威: 1, ELLE: 0, 誠品: 0 });
  });

  it('同倉庫重複出現覆蓋不累加；不同倉庫落同庫別則相加', () => {
    const dup = [
      makeTable('展威麗嬰房', [makeRow('P-1', 'x', 5)]),
      makeTable('展威麗嬰房', [makeRow('P-1', 'x', 5)]),          // 同倉重複 → 覆蓋
      makeTable('展威麗嬰房(平台總倉)', [makeRow('P-1', 'x', 3)]), // 不同倉、同為展威 → 相加
    ];
    const wm = { '展威麗嬰房': '展威', '展威麗嬰房(平台總倉)': '展威' };
    const [item] = buildSummary(dup, { warehouseMapping: wm });
    expect(item.展威).toBe(8);
  });

  it('凌駕規則把整列改到指定庫別', () => {
    const rules = [{ prefix: '4000016', category: 'ELLE', override: true }];
    const [item] = buildSummary(tables, { warehouseMapping, categoryRules: rules });
    // 四個倉庫的量全部改落 ELLE
    expect(item.ELLE).toBe(40 + 19 + 33 + 1);
    expect(item).toMatchObject({ 總倉: 0, 官網: 0, 平台: 0, 展威: 0 });
  });

  it('品牌規則填入 brand 欄', () => {
    const [item] = buildSummary(tables, { warehouseMapping, brandRules: [{ prefix: '4', brand: '麗嬰' }] });
    expect(item.brand).toBe('麗嬰');
  });

  it('年度倒序 → 同年度依商品代號自然排序', () => {
    const mixed = [
      makeTable('展宇麗嬰房總倉', [
        makeRow('B-2', 'x', 1, { year: 2025 }),
        makeRow('A-1', 'x', 1, { year: 2027 }),
        makeRow('A-2', 'x', 1, { year: 2027 }),
      ]),
    ];
    const codes = buildSummary(mixed, { warehouseMapping }).map(i => i.productCode);
    expect(codes).toEqual(['A-1', 'A-2', 'B-2']);
  });
});

describe('buildColumns / cellValue', () => {
  it('倉庫別不含品牌欄，品牌別含品牌欄', () => {
    expect(buildColumns('倉庫別').map(c => c.key)).not.toContain('品牌');
    const brandCols = buildColumns('品牌別').map(c => c.key);
    expect(brandCols).toContain('品牌');
    // 品牌欄插在庫別之後、備註之前
    expect(brandCols.indexOf('品牌')).toBeGreaterThan(brandCols.indexOf('誠品'));
    expect(brandCols.indexOf('品牌')).toBeLessThan(brandCols.indexOf('備註'));
  });

  it('cellValue：庫別為 0 留白、貨號經 getItemNumber、品牌取 brand', () => {
    const item = { productCode: '4000016-0001U-356', productName: 'Color', brand: '麗嬰', 總倉: 40, 官網: 0 };
    expect(cellValue(item, '總倉')).toBe(40);
    expect(cellValue(item, '官網')).toBe('');
    expect(cellValue(item, '貨號')).toBe('4000016-0001U');
    expect(cellValue(item, '品牌')).toBe('麗嬰');
    expect(cellValue(item, '備註')).toBe('');
  });
});
