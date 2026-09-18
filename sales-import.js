/*
 * Ian OS - 销量数据 Excel 导入
 *
 * 数据来源：
 * 腾讯文档导出的 Excel
 *
 * 导入范围：
 * 只读取类似 2025.7 / 2025.8 / 2026.9 的月度销量 Sheet
 *
 * 核心唯一识别：
 * sale_date + product_name + variant
 *
 * SKU ID / SKU：
 * 只保存为辅助字段，不参与唯一判断。
 *
 * 重要：
 * - 不删除 sales_records 里的旧数据
 * - 不清空月份
 * - 再次导入同一天、同一产品、同一销售属性时，只更新原记录
 * - Excel 日期按 Excel 原始日期值解析，避免时区导致日期前移一天
 *
 * 导入结果：
 * - 统计新增记录数量
 * - 统计更新记录数量
 * - 显示导入月份
 * - 显示新增 / 更新 / 总计结果卡片
 *
 * 修复：
 * - Supabase 单次查询默认可能只返回 1000 条
 * - 查询已有记录时改为分页读取
 * - 防止 77,308 条数据被错误判断成
 *   76,308 条新增 + 1,000 条更新
 *
 * 缓存联动：
 * - Excel 成功导入后，自动更新销量数据版本号
 * - sales.js 检测到版本号变化后，会自动放弃旧缓存
 */


/* =========================================================
 * 基础配置
 * ========================================================= */

const SALES_TABLE = "sales_records";

const BATCH_SIZE = 500;

/*
 * 销量分析页面的缓存版本号。
 *
 * 每次成功导入 Excel 后都会更新。
 *
 * sales.js 会读取这个值，
 * 如果发现版本变化，就不会继续使用旧缓存。
 */
const SALES_CACHE_VERSION_KEY = "ian_os_sales_data_version";

let parsedRecords = [];

let parsedSheets = [];


/* =========================================================
 * Supabase
 * ========================================================= */

function getSupabaseClient() {
  return window.supabaseClient || window.supabase || null;
}


/* =========================================================
 * 基础工具
 * ========================================================= */

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}


/*
 * 只允许读取类似：
 *
 * 2025.7
 * 2025.8
 * 2026.9
 */
function isMonthlySheetName(name) {
  return /^\d{4}\.\d{1,2}$/.test(
    normalizeText(name)
  );
}


/*
 * 将年份 + 月份转换成：
 *
 * 2026-09
 */
function formatMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}


/*
 * 将：
 *
 * 2026-09
 *
 * 转换成：
 *
 * 2026年09月
 */
function formatMonthDisplay(month) {
  if (!month) {
    return "";
  }

  const match = String(month).match(
    /^(\d{4})-(\d{1,2})$/
  );

  if (!match) {
    return month;
  }

  return `${match[1]}年${String(match[2]).padStart(2, "0")}月`;
}


/* =========================================================
 * Excel 日期解析
 * =========================================================
 *
 * 不使用 new Date() 的本地时区转换。
 *
 * Excel 数字日期：
 * 使用 XLSX.SSF.parse_date_code()
 *
 * Excel 字符串日期：
 * 支持：
 *
 * YYYY-MM-DD
 * YYYY/MM/DD
 * YYYY.MM.DD
 *
 * 避免浏览器时区导致日期前移一天。
 */


/*
 * 将 Excel 日期转换成：
 *
 * {
 *   year,
 *   month,
 *   day
 * }
 */
function dateToParts(value) {

  /*
   * Excel Serial Date
   */
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {

    const parsed =
      XLSX.SSF.parse_date_code(value);

    if (
      parsed &&
      parsed.y &&
      parsed.m &&
      parsed.d
    ) {

      return {
        year: parsed.y,
        month: parsed.m,
        day: parsed.d
      };
    }
  }


  /*
   * 字符串日期
   */
  const text =
    normalizeText(value);

  const match =
    text.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
    );

  if (match) {

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }


  return null;
}


/*
 * 将日期 Parts 转换成：
 *
 * YYYY-MM-DD
 */
function toDateString(parts) {

  if (!parts) {
    return "";
  }

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}


/* =========================================================
 * 销量数字处理
 * ========================================================= */

function toSalesNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }


  /*
   * 已经是数字
   */
  if (typeof value === "number") {

    return Number.isFinite(value)
      ? value
      : 0;
  }


  /*
   * 字符串数字
   */
  const cleaned =
    String(value)
      .replace(/,/g, "")
      .replace(/\s/g, "")
      .trim();

  if (!cleaned) {
    return 0;
  }


  const number =
    Number(cleaned);


  return Number.isFinite(number)
    ? number
    : 0;
}


/* =========================================================
 * Excel 行判断
 * ========================================================= */

function isFormulaStorageRow(row) {

  const values =
    row
      .slice(0, 4)
      .map(normalizeText);

  return values.some(
    value => value === "公式存放行"
  );
}


function isValidDataRow(row) {

  const productName =
    normalizeText(row[2]);

  const variant =
    normalizeText(row[3]);


  /*
   * 产品名称不能为空
   */
  if (!productName) {
    return false;
  }


  /*
   * 销售属性不能为空
   */
  if (!variant) {
    return false;
  }


  /*
   * 排除公式存放行
   */
  if (isFormulaStorageRow(row)) {
    return false;
  }


  return true;
}


/* =========================================================
 * 解析单个月份 Sheet
 * ========================================================= */

function parseMonthlySheet(
  workbook,
  sheetName
) {

  const worksheet =
    workbook.Sheets[sheetName];


  if (!worksheet) {

    return {
      sheetName,
      records: [],
      rowCount: 0,
      dateColumnCount: 0,
      skippedRows: 0
    };
  }


  /*
   * Excel 转二维数组
   */
  const rows =
    XLSX.utils.sheet_to_json(
      worksheet,
      {
        header: 1,
        defval: null,
        raw: true,
        blankrows: false
      }
    );


  if (!rows.length) {

    return {
      sheetName,
      records: [],
      rowCount: 0,
      dateColumnCount: 0,
      skippedRows: 0
    };
  }


  const header =
    rows[0] || [];


  const dateColumns = [];


  /*
   * 前 4 列：
   *
   * 0 = SKU ID
   * 1 = SKU
   * 2 = 产品名称
   * 3 = 销售属性
   *
   * 从第 5 列开始寻找日期。
   */
  for (
    let columnIndex = 4;
    columnIndex < header.length;
    columnIndex += 1
  ) {

    const parts =
      dateToParts(
        header[columnIndex]
      );


    if (!parts) {
      continue;
    }


    dateColumns.push({
      columnIndex,
      parts,
      date:
        toDateString(parts)
    });
  }


  const records = [];

  let skippedRows = 0;


  /*
   * 遍历产品行
   */
  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {

    const row =
      rows[rowIndex] || [];


    /*
     * 无效行直接跳过
     */
    if (!isValidDataRow(row)) {

      skippedRows += 1;

      continue;
    }


    const skuId =
      normalizeText(row[0]);

    const sku =
      normalizeText(row[1]);

    const productName =
      normalizeText(row[2]);

    const variant =
      normalizeText(row[3]);


    /*
     * 遍历日期列
     */
    for (const dateColumn of dateColumns) {

      const sales =
        toSalesNumber(
          row[dateColumn.columnIndex]
        );


      records.push({

        sale_date:
          dateColumn.date,

        month:
          formatMonth(
            dateColumn.parts.year,
            dateColumn.parts.month
          ),

        product_name:
          productName,

        variant,

        sales,

        sku_id:
          skuId || null,

        sku:
          sku || null

      });
    }
  }


  return {

    sheetName,

    records,

    rowCount:
      rows.length - 1,

    dateColumnCount:
      dateColumns.length,

    skippedRows

  };
}


/* =========================================================
 * Excel 内部去重
 * =========================================================
 *
 * 唯一键：
 *
 * sale_date
 * +
 * product_name
 * +
 * variant
 *
 * 如果同一个 Excel 中出现重复：
 * 使用最后读取到的记录。
 */

function deduplicateRecords(records) {

  const map =
    new Map();


  for (const record of records) {

    const key = [

      record.sale_date,

      record.product_name,

      record.variant

    ].join("||");


    map.set(
      key,
      record
    );
  }


  return Array.from(
    map.values()
  );
}


/* =========================================================
 * 生成预览
 * ========================================================= */

function buildPreview(workbook) {

  /*
   * 找到所有月份 Sheet
   */
  const monthlySheets =
    workbook.SheetNames.filter(
      isMonthlySheetName
    );


  if (!monthlySheets.length) {

    throw new Error(
      "没有找到类似 2025.7 / 2025.8 / 2026.9 的月度销量 Sheet。"
    );
  }


  const allRecords = [];

  const sheetResults = [];


  /*
   * 逐个 Sheet 解析
   */
  for (
    const sheetName of monthlySheets
  ) {

    const result =
      parseMonthlySheet(
        workbook,
        sheetName
      );


    sheetResults.push(
      result
    );


    allRecords.push(
      ...result.records
    );
  }


  /*
   * Excel 内部去重
   */
  parsedRecords =
    deduplicateRecords(
      allRecords
    );


  parsedSheets =
    sheetResults;


  return {

    sheetCount:
      monthlySheets.length,

    productCount:
      new Set(
        parsedRecords.map(
          record =>
            record.product_name
        )
      ).size,

    variantCount:
      new Set(
        parsedRecords.map(
          record =>
            `${record.product_name}||${record.variant}`
        )
      ).size,

    recordCount:
      parsedRecords.length

  };
}


/* =========================================================
 * 获取本次导入月份
 * ========================================================= */

function getImportedMonths() {

  const months =
    Array.from(
      new Set(
        parsedRecords
          .map(
            record =>
              record.month
          )
          .filter(Boolean)
      )
    );


  months.sort();


  return months;
}


/* =========================================================
 * 渲染预览
 * ========================================================= */

function renderPreview(summary) {

  document
    .getElementById(
      "summary-card"
    )
    .classList.remove(
      "hidden"
    );


  /*
   * 基础统计
   */

  document.getElementById(
    "sheet-count"
  ).textContent =
    summary.sheetCount
      .toLocaleString();


  document.getElementById(
    "product-count"
  ).textContent =
    summary.productCount
      .toLocaleString();


  document.getElementById(
    "variant-count"
  ).textContent =
    summary.variantCount
      .toLocaleString();


  document.getElementById(
    "record-count"
  ).textContent =
    summary.recordCount
      .toLocaleString();


  /*
   * 显示导入月份
   */

  const months =
    getImportedMonths();


  const monthElement =
    document.getElementById(
      "preview-month"
    );


  if (monthElement) {

    if (months.length === 1) {

      monthElement.textContent =
        formatMonthDisplay(
          months[0]
        );

    } else if (months.length > 1) {

      /*
       * 多月份时不再把所有月份全部塞进标题，
       * 避免文字过长。
       */

      const firstMonth =
        formatMonthDisplay(
          months[0]
        );

      const lastMonth =
        formatMonthDisplay(
          months[months.length - 1]
        );


      monthElement.textContent =
        `${months.length} 个月份 · ${firstMonth} — ${lastMonth}`;

    } else {

      monthElement.textContent =
        "等待读取 Excel";
    }
  }


  /*
   * 更新状态
   */

  const statusElement =
    document.getElementById(
      "preview-status"
    );


  if (statusElement) {

    statusElement.textContent =
      "已读取";

    statusElement.classList.add(
      "is-ready"
    );
  }


  /*
   * Sheet 列表
   */

  const list =
    document.getElementById(
      "sheet-list"
    );


  list.innerHTML =
    parsedSheets
      .map(
        item => `

          <div class="sheet-item">

            <div>

              <strong>
                ${escapeHtml(
                  item.sheetName
                )}
              </strong>

              <span>
                ${item.dateColumnCount} 个日期 ·
                ${item.records.length.toLocaleString()} 条记录
              </span>

            </div>

            <div>
              跳过 ${item.skippedRows.toLocaleString()} 行
            </div>

          </div>

        `
      )
      .join("");


  /*
   * 有数据才能导入
   */

  document.getElementById(
    "import-btn"
  ).disabled =
    parsedRecords.length === 0;
}


/* =========================================================
 * HTML 安全转义
 * ========================================================= */

function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
 * 读取 Excel
 * ========================================================= */

async function readSelectedExcel() {

  const input =
    document.getElementById(
      "excel-file"
    );


  const file =
    input.files &&
    input.files[0];


  if (!file) {

    throw new Error(
      "请先选择 Excel 文件。"
    );
  }


  /*
   * 确认 XLSX 库已经加载
   */

  if (
    typeof XLSX === "undefined"
  ) {

    throw new Error(
      "Excel 解析库加载失败，请检查网络连接后刷新页面。"
    );
  }


  /*
   * 读取文件
   */

  const buffer =
    await file.arrayBuffer();


  /*
   * 关键：
   *
   * cellDates = false
   *
   * Excel 日期保持原始 serial date，
   * 不经过浏览器时区转换。
   */

  const workbook =
    XLSX.read(
      buffer,
      {
        type: "array",
        cellDates: false
      }
    );


  return buildPreview(
    workbook
  );
}


/* =========================================================
 * 进度条
 * ========================================================= */

function setProgress(
  percent,
  text
) {

  document
    .getElementById(
      "progress-card"
    )
    .classList.remove(
      "hidden"
    );


  const bar =
    document.getElementById(
      "progress-bar"
    );


  bar.style.width =
    `${Math.max(
      0,
      Math.min(
        100,
        percent
      )
    )}%`;


  document.getElementById(
    "progress-text"
  ).textContent =
    text;
}


/* =========================================================
 * 结果消息
 * ========================================================= */

function setResultMessage(
  message,
  type
) {

  const element =
    document.getElementById(
      "result-message"
    );


  element.textContent =
    message;


  element.className =
    `result-message ${type || ""}`;
}


/* =========================================================
 * 导入结果卡片
 * ========================================================= */

function renderImportResult(
  insertedCount,
  updatedCount,
  total
) {

  const resultCard =
    document.getElementById(
      "import-result"
    );


  if (!resultCard) {
    return;
  }


  /*
   * 显示结果卡片
   */

  resultCard.classList.remove(
    "hidden"
  );


  /*
   * 新增
   */

  document.getElementById(
    "inserted-count"
  ).textContent =
    insertedCount
      .toLocaleString();


  /*
   * 更新
   */

  document.getElementById(
    "updated-count"
  ).textContent =
    updatedCount
      .toLocaleString();


  /*
   * 总计
   */

  document.getElementById(
    "total-imported-count"
  ).textContent =
    total
      .toLocaleString();


  /*
   * 显示月份
   */

  const months =
    getImportedMonths();


  const monthElement =
    document.getElementById(
      "result-month"
    );


  if (monthElement) {

    if (months.length === 1) {

      monthElement.textContent =
        `${formatMonthDisplay(
          months[0]
        )} · 销量数据已同步`;

    } else if (months.length > 1) {

      const firstMonth =
        formatMonthDisplay(
          months[0]
        );

      const lastMonth =
        formatMonthDisplay(
          months[months.length - 1]
        );


      monthElement.textContent =
        `${months.length} 个月份 · ${firstMonth} — ${lastMonth} · 销量数据已同步`;

    } else {

      monthElement.textContent =
        "销量数据已同步";
    }
  }
}


/* =========================================================
 * 生成数据库唯一 Key
 * ========================================================= */

function getRecordKey(record) {

  return [

    record.sale_date,

    normalizeText(
      record.product_name
    ),

    normalizeText(
      record.variant
    )

  ].join("||");
}


/* =========================================================
 * 查询数据库中已经存在的记录
 * =========================================================
 *
 * 重要修复：
 *
 * Supabase 单次查询可能只返回 1000 条。
 *
 * 所以这里不能直接：
 *
 * .select(...)
 *
 * 然后认为返回结果就是全部数据。
 *
 * 现在改成分页：
 *
 * 1000
 * 1000
 * 1000
 * ...
 *
 * 直到读取完整个日期范围。
 */


/*
 * 分页查询已有记录
 */

async function getExistingRecordKeys(
  client,
  records
) {

  const existingKeys =
    new Set();


  /*
   * 没有记录直接返回
   */

  if (!records.length) {
    return existingKeys;
  }


  /*
   * 找到本次 Excel 的日期范围
   */

  const dates =
    records
      .map(
        record =>
          record.sale_date
      )
      .filter(Boolean)
      .sort();


  if (!dates.length) {
    return existingKeys;
  }


  const minDate =
    dates[0];

  const maxDate =
    dates[dates.length - 1];


  /*
   * Supabase 分页大小
   */

  const PAGE_SIZE = 1000;


  /*
   * 当前分页起点
   */

  let from = 0;


  /*
   * 是否继续读取
   */

  let hasMore = true;


  /*
   * 记录查询页数
   */

  let page = 0;


  while (hasMore) {

    page += 1;


    const to =
      from + PAGE_SIZE - 1;


    console.log(
      `正在查询数据库已有记录：第 ${page} 页，${from} - ${to}`
    );


    /*
     * 查询这一页
     */

    const {
      data,
      error
    } = await client

      .from(
        SALES_TABLE
      )

      .select(
        "sale_date, product_name, variant"
      )

      .gte(
        "sale_date",
        minDate
      )

      .lte(
        "sale_date",
        maxDate
      )

      .range(
        from,
        to
      );


    /*
     * Supabase 查询错误
     */

    if (error) {
      throw error;
    }


    const rows =
      data || [];


    /*
     * 将这一页的记录加入 Set
     */

    for (
      const row of rows
    ) {

      const key = [

        row.sale_date,

        normalizeText(
          row.product_name
        ),

        normalizeText(
          row.variant
        )

      ].join("||");


      existingKeys.add(
        key
      );
    }


    /*
     * 如果不足 1000 条，
     * 说明已经到最后一页。
     */

    if (
      rows.length < PAGE_SIZE
    ) {

      hasMore = false;

    } else {

      /*
       * 下一页
       */

      from += PAGE_SIZE;
    }


    /*
     * 防止异常情况下无限循环
     */

    if (
      from > 1000000
    ) {

      throw new Error(
        "读取 Supabase 已有销量记录超过 100 万条，请检查数据范围。"
      );
    }
  }


  /*
   * 输出最终读取数量
   */

  console.log(
    `数据库已有记录：${existingKeys.size.toLocaleString()} 条`
  );


  return existingKeys;
}


/* =========================================================
 * 单批 Upsert
 * ========================================================= */

async function upsertBatch(
  client,
  batch
) {

  const {
    error
  } = await client

    .from(
      SALES_TABLE
    )

    .upsert(
      batch,
      {
        onConflict:
          "sale_date,product_name,variant"
      }
    );


  if (error) {
    throw error;
  }
}


/* =========================================================
 * 通知销量分析页面：
 * 数据已经发生变化
 * ========================================================= */

function updateSalesCacheVersion() {

  const version =
    String(Date.now());


  try {

    localStorage.setItem(
      SALES_CACHE_VERSION_KEY,
      version
    );

    console.log(
      `销量数据缓存版本已更新：${version}`
    );

  } catch (error) {

    /*
     * localStorage 即使失败，
     * 也不能影响已经成功完成的数据库导入。
     */

    console.warn(
      "更新销量数据缓存版本失败：",
      error
    );
  }
}


/* =========================================================
 * 正式导入
 * ========================================================= */

async function importRecords() {

  const client =
    getSupabaseClient();


  /*
   * 检查 Supabase
   */

  if (!client) {

    throw new Error(
      "没有找到 Supabase 客户端。请确认 supabase.js 已正确加载。"
    );
  }


  /*
   * 检查数据
   */

  if (!parsedRecords.length) {

    throw new Error(
      "当前没有可导入的数据，请先读取并预览 Excel。"
    );
  }


  const total =
    parsedRecords.length;


  let completed = 0;

  let insertedCount = 0;

  let updatedCount = 0;


  /*
   * =====================================================
   * 第一步：
   * 查询数据库已经存在的 Key
   * =====================================================
   */

  setProgress(
    0,
    `正在检查 ${total.toLocaleString()} 条记录...`
  );


  setResultMessage(
    "",
    ""
  );


  /*
   * 隐藏上一次结果
   */

  const oldResult =
    document.getElementById(
      "import-result"
    );


  if (oldResult) {

    oldResult.classList.add(
      "hidden"
    );
  }


  /*
   * 分页读取数据库已有记录
   */

  const existingKeys =
    await getExistingRecordKeys(
      client,
      parsedRecords
    );


  /*
   * =====================================================
   * 第二步：
   * 根据导入前数据库状态统计
   *
   * 已存在 = 更新
   * 不存在 = 新增
   * =====================================================
   */

  for (
    const record of parsedRecords
  ) {

    const key =
      getRecordKey(
        record
      );


    if (
      existingKeys.has(key)
    ) {

      updatedCount += 1;

    } else {

      insertedCount += 1;
    }
  }


  /*
   * =====================================================
   * 第三步：
   * 显示检查结果
   * =====================================================
   */

  setProgress(
    0,
    `检查完成：新增 ${insertedCount.toLocaleString()} 条 · 更新 ${updatedCount.toLocaleString()} 条`
  );


  /*
   * =====================================================
   * 第四步：
   * 开始真正 Upsert
   * =====================================================
   */

  for (
    let start = 0;
    start < total;
    start += BATCH_SIZE
  ) {

    const batch =
      parsedRecords.slice(
        start,
        start + BATCH_SIZE
      );


    /*
     * 写入 Supabase
     */

    await upsertBatch(
      client,
      batch
    );


    /*
     * 更新进度
     */

    completed +=
      batch.length;


    const percent =
      (completed / total) * 100;


    setProgress(
      percent,
      `正在导入：${completed.toLocaleString()} / ${total.toLocaleString()}`
    );
  }


  /*
   * =====================================================
   * 第五步：
   * 导入完成
   * =====================================================
   */

  /*
   * 非常重要：
   *
   * 只有所有 Upsert 全部成功之后，
   * 才更新缓存版本号。
   *
   * 这样不会出现：
   * 数据还没导完，
   * sales.js 就认为缓存已经过期。
   */

  updateSalesCacheVersion();


  setProgress(
    100,
    `导入完成，共 ${total.toLocaleString()} 条`
  );


  renderImportResult(
    insertedCount,
    updatedCount,
    total
  );


  setResultMessage(
    "",
    ""
  );
}


/* =========================================================
 * 预览按钮
 * ========================================================= */

async function handlePreview() {

  const button =
    document.getElementById(
      "preview-btn"
    );


  button.disabled = true;


  setResultMessage(
    "",
    ""
  );


  try {

    /*
     * 清除上一次结果卡片
     */

    const oldResult =
      document.getElementById(
        "import-result"
      );


    if (oldResult) {

      oldResult.classList.add(
        "hidden"
      );
    }


    /*
     * 开始读取
     */

    setProgress(
      0,
      "正在读取 Excel..."
    );


    const summary =
      await readSelectedExcel();


    /*
     * 渲染预览
     */

    renderPreview(
      summary
    );


    /*
     * 读取完成
     */

    setProgress(
      100,
      `读取完成，共 ${summary.recordCount.toLocaleString()} 条销量记录`
    );


    setResultMessage(
      "预览成功。确认月份和记录数量无误后，可以点击“开始导入 Supabase”。",
      "success"
    );

  } catch (error) {

    console.error(
      "读取 Excel 失败：",
      error
    );


    setResultMessage(
      `读取失败：${error.message || error}`,
      "error"
    );


    setProgress(
      0,
      "读取失败"
    );

  } finally {

    button.disabled = false;
  }
}


/* =========================================================
 * 导入按钮
 * ========================================================= */

async function handleImport() {

  const button =
    document.getElementById(
      "import-btn"
    );


  button.disabled = true;


  document.getElementById(
    "preview-btn"
  ).disabled = true;


  try {

    await importRecords();

  } catch (error) {

    console.error(
      "导入销量数据失败：",
      error
    );


    setResultMessage(
      `导入失败：${error.message || error}`,
      "error"
    );

  } finally {

    button.disabled = false;


    document.getElementById(
      "preview-btn"
    ).disabled = false;
  }
}


/* =========================================================
 * 页面初始化
 * ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * 读取并预览
     */

    document
      .getElementById(
        "preview-btn"
      )
      .addEventListener(
        "click",
        handlePreview
      );


    /*
     * 开始导入
     */

    document
      .getElementById(
        "import-btn"
      )
      .addEventListener(
        "click",
        handleImport
      );


    /*
     * 检查 Supabase
     */

    if (
      !getSupabaseClient()
    ) {

      console.warn(
        "销量导入页面加载时未检测到 Supabase 客户端，请确认 supabase.js 配置正常。"
      );
    }
  }
);