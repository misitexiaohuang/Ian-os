const SALES_TABLE = "sales_records";

const PAGE_SIZE = 1000;

const CACHE_DB_NAME = "ian_os_sales_cache";

const CACHE_DB_VERSION = 1;

const CACHE_STORE_NAME = "months";

const SALES_CACHE_VERSION_KEY =
  "ian_os_sales_data_version";


/*
  自动检测数据库更新的时间间隔
  10 秒检查一次 localStorage 版本号
*/
const AUTO_CHECK_INTERVAL = 10000;


let allMonths = [];

let currentMonth = "";

let monthCache = new Map();

let currentMonthRecords = [];

let dailyChartState = null;

let productChartState = null;

let variantChartState = null;


/* =========================================================
   当前时间范围
========================================================= */

let currentDateRange = {
  type: "month",
  start: null,
  end: null
};


/* =========================================================
   自动更新状态
========================================================= */

let lastKnownSalesCacheVersion =
  getSalesCacheVersion();

let isAutoRefreshing = false;


/* =========================================================
   基础工具
========================================================= */

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}


function formatDate(dateString) {
  const parts = String(dateString).split("-");

  if (parts.length !== 3) {
    return dateString;
  }

  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}


function normalizeDateString(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text.slice(0, 10);
}


function dateToString(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function stringToDate(dateString) {
  const parts = String(
    dateString || ""
  ).split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);

  const month = Number(parts[1]);

  const day = Number(parts[2]);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


function addDays(
  dateString,
  amount
) {
  const date =
    stringToDate(dateString);

  if (!date) {
    return "";
  }

  date.setDate(
    date.getDate() + amount
  );

  return dateToString(date);
}


function compareDateStrings(
  a,
  b
) {
  return String(a).localeCompare(
    String(b)
  );
}


function isDateInRange(
  date,
  start,
  end
) {
  if (!date || !start || !end) {
    return false;
  }

  return (
    date >= start &&
    date <= end
  );
}


/* =========================================================
   自然排序
========================================================= */

function naturalSort(a, b) {
  return String(a).localeCompare(
    String(b),
    undefined,
    {
      numeric: true,
      sensitivity: "base"
    }
  );
}


/* =========================================================
   尺码排序
========================================================= */

function sizeSort(a, b) {
  const valueA = String(a).trim();

  const valueB = String(b).trim();

  const numberA = Number(valueA);

  const numberB = Number(valueB);

  const isNumberA =
    !Number.isNaN(numberA);

  const isNumberB =
    !Number.isNaN(numberB);


  if (
    isNumberA &&
    isNumberB
  ) {
    return numberA - numberB;
  }


  if (isNumberA) {
    return -1;
  }


  if (isNumberB) {
    return 1;
  }


  const sizeOrder = {
    "XXS": 0,
    "XS": 1,
    "S": 2,
    "M": 3,
    "L": 4,
    "XL": 5,
    "2XL": 6,
    "XXL": 6,
    "3XL": 7,
    "XXXL": 7,
    "4XL": 8,
    "5XL": 9
  };


  const upperA =
    valueA.toUpperCase();

  const upperB =
    valueB.toUpperCase();


  const orderA =
    sizeOrder[upperA];

  const orderB =
    sizeOrder[upperB];


  if (
    orderA !== undefined &&
    orderB !== undefined
  ) {
    return orderA - orderB;
  }


  if (
    orderA !== undefined
  ) {
    return -1;
  }


  if (
    orderB !== undefined
  ) {
    return 1;
  }


  return naturalSort(
    valueA,
    valueB
  );
}


/* =========================================================
   月份
========================================================= */

function parseMonth(month) {
  const match =
    String(month).match(
      /^(\d{4})-(\d{2})$/
    );


  if (!match) {
    return null;
  }


  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}


function getMonthFromDate(
  dateString
) {
  const date =
    stringToDate(dateString);

  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}


function getMonthsBetween(
  startDate,
  endDate
) {
  const start =
    stringToDate(startDate);

  const end =
    stringToDate(endDate);

  if (!start || !end) {
    return [];
  }

  const first =
    new Date(
      start.getFullYear(),
      start.getMonth(),
      1
    );

  const last =
    new Date(
      end.getFullYear(),
      end.getMonth(),
      1
    );

  const months = [];

  const current =
    new Date(first);

  while (
    current <= last
  ) {
    months.push(
      `${current.getFullYear()}-${String(
        current.getMonth() + 1
      ).padStart(2, "0")}`
    );

    current.setMonth(
      current.getMonth() + 1
    );
  }

  return months;
}


function generateDateRange(
  startDate,
  endDate
) {
  const dates = [];

  const start =
    stringToDate(startDate);

  const end =
    stringToDate(endDate);


  if (!start || !end) {
    return dates;
  }


  const current =
    new Date(start);


  while (
    current <= end
  ) {
    dates.push(
      dateToString(current)
    );

    current.setDate(
      current.getDate() + 1
    );
  }


  return dates;
}


/* =========================================================
   数据标准化
========================================================= */

function normalizeRecord(record) {
  return {
    sale_date:
      normalizeDateString(
        record.sale_date
      ),

    month:
      String(
        record.month || ""
      ),

    product_name:
      String(
        record.product_name || ""
      ).trim(),

    variant:
      String(
        record.variant || ""
      ).trim(),

    sales:
      Number(
        record.sales || 0
      )
  };
}


/* =========================================================
   IndexedDB 本地缓存
========================================================= */

function openCacheDB() {
  return new Promise(
    (resolve, reject) => {

      const request =
        indexedDB.open(
          CACHE_DB_NAME,
          CACHE_DB_VERSION
        );


      request.onupgradeneeded =
        event => {

          const db =
            event.target.result;


          if (
            !db.objectStoreNames.contains(
              CACHE_STORE_NAME
            )
          ) {

            db.createObjectStore(
              CACHE_STORE_NAME,
              {
                keyPath: "month"
              }
            );

          }

        };


      request.onsuccess =
        event => {

          resolve(
            event.target.result
          );

        };


      request.onerror =
        event => {

          reject(
            event.target.error
          );

        };

    }
  );
}


/* =========================================================
   获取当前缓存版本
========================================================= */

function getSalesCacheVersion() {
  return localStorage.getItem(
    SALES_CACHE_VERSION_KEY
  ) || "";
}


/* =========================================================
   从 IndexedDB 获取月份缓存
========================================================= */

async function getCachedMonth(
  month
) {

  try {

    const db =
      await openCacheDB();


    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            CACHE_STORE_NAME,
            "readonly"
          );


        const store =
          transaction.objectStore(
            CACHE_STORE_NAME
          );


        const request =
          store.get(month);


        request.onsuccess =
          () => {

            const result =
              request.result;


            if (
              !result ||
              !Array.isArray(
                result.records
              )
            ) {

              resolve(null);

              return;
            }


            const currentVersion =
              getSalesCacheVersion();


            /*
              只要当前系统存在版本号，
              缓存就必须使用同一个版本。

              这样可以防止：
              旧缓存没有 version，
              但数据库已经更新，
              仍然错误使用旧数据。
            */

            if (
              currentVersion &&
              result.version !==
                currentVersion
            ) {

              console.log(
                `缓存版本过期：${month}`
              );

              resolve(null);

              return;
            }


            resolve(
              result.records.map(
                normalizeRecord
              )
            );

          };


        request.onerror =
          event => {

            reject(
              event.target.error
            );

          };

      }
    );

  } catch (error) {

    console.warn(
      "读取本地销量缓存失败：",
      error
    );

    return null;
  }
}


/* =========================================================
   写入 IndexedDB 月份缓存
========================================================= */

async function saveCachedMonth(
  month,
  records
) {

  try {

    const db =
      await openCacheDB();


    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            CACHE_STORE_NAME,
            "readwrite"
          );


        const store =
          transaction.objectStore(
            CACHE_STORE_NAME
          );


        store.put({

          month,

          records,

          updatedAt:
            Date.now(),

          version:
            getSalesCacheVersion()

        });


        transaction.oncomplete =
          () => {

            resolve();

          };


        transaction.onerror =
          event => {

            reject(
              event.target.error
            );

          };

      }
    );

  } catch (error) {

    console.warn(
      "保存销量缓存失败：",
      error
    );

  }
}


/* =========================================================
   删除某个月份缓存
========================================================= */

async function deleteCachedMonth(
  month
) {

  try {

    const db =
      await openCacheDB();


    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            CACHE_STORE_NAME,
            "readwrite"
          );


        const store =
          transaction.objectStore(
            CACHE_STORE_NAME
          );


        store.delete(month);


        transaction.oncomplete =
          () => {

            resolve();

          };


        transaction.onerror =
          event => {

            reject(
              event.target.error
            );

          };

      }
    );

  } catch (error) {

    console.warn(
      "删除销量缓存失败：",
      error
    );

  }
}


/* =========================================================
   清空全部月份缓存
========================================================= */

async function clearAllSalesCache() {

  try {

    const db =
      await openCacheDB();


    return new Promise(
      (resolve, reject) => {

        const transaction =
          db.transaction(
            CACHE_STORE_NAME,
            "readwrite"
          );


        const store =
          transaction.objectStore(
            CACHE_STORE_NAME
          );


        store.clear();


        transaction.oncomplete =
          () => {

            resolve();

          };


        transaction.onerror =
          event => {

            reject(
              event.target.error
            );

          };

      }
    );

  } catch (error) {

    console.warn(
      "清空销量缓存失败：",
      error
    );

  }
}


/* =========================================================
   Supabase
========================================================= */

async function getSalesClient() {

  if (
    typeof supabaseClient !==
      "undefined" &&
    supabaseClient
  ) {

    return supabaseClient;

  }


  if (
    typeof window.supabase !==
      "undefined" &&
    typeof window.SUPABASE_URL !==
      "undefined"
  ) {

    return window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );

  }


  if (
    typeof supabase !==
      "undefined"
  ) {

    return supabase;

  }


  throw new Error(
    "Supabase 客户端未找到，请检查 supabase.js"
  );
}


/* =========================================================
   获取月份范围
========================================================= */

async function loadMonthRange(
  client
) {

  const [
    firstResult,
    lastResult
  ] = await Promise.all([

    client
      .from(SALES_TABLE)
      .select(
        "sale_date,month"
      )
      .order(
        "sale_date",
        {
          ascending: true
        }
      )
      .limit(1)
      .maybeSingle(),

    client
      .from(SALES_TABLE)
      .select(
        "sale_date,month"
      )
      .order(
        "sale_date",
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle()

  ]);


  if (firstResult.error) {
    throw firstResult.error;
  }


  if (lastResult.error) {
    throw lastResult.error;
  }


  if (
    !firstResult.data ||
    !lastResult.data
  ) {

    return [];

  }


  const firstMonth =
    firstResult.data.month;

  const lastMonth =
    lastResult.data.month;


  const first =
    parseMonth(firstMonth);

  const last =
    parseMonth(lastMonth);


  if (!first || !last) {
    return [];
  }


  const months = [];


  let year =
    first.year;

  let month =
    first.month;


  while (
    year < last.year ||
    (
      year === last.year &&
      month <= last.month
    )
  ) {

    months.push(
      `${year}-${String(month).padStart(2, "0")}`
    );


    month++;


    if (month > 12) {

      month = 1;

      year++;

    }

  }


  return months.reverse();
}


/* =========================================================
   获取某个月全部数据
   修复：分页使用 sale_date + id 稳定排序
========================================================= */

async function loadMonthRecords(client, month) {
  const currentVersion = getSalesCacheVersion();

  // 1. 检查内存缓存
  if (monthCache.has(month)) {
    const memoryItem = monthCache.get(month);

    // 兼容旧格式：旧数组缓存直接作废，避免继续使用无法校验版本的数据
    if (Array.isArray(memoryItem)) {
      monthCache.delete(month);
    } else if (
      memoryItem &&
      Array.isArray(memoryItem.records) &&
      (!currentVersion || memoryItem.version === currentVersion)
    ) {
      return memoryItem.records;
    } else {
      monthCache.delete(month);
    }
  }

  // 2. 检查 IndexedDB 缓存
  const cachedRecords = await getCachedMonth(month);

  if (cachedRecords && cachedRecords.length) {
    console.log(
      `使用本地缓存：${month}，${cachedRecords.length} 条`
    );

    monthCache.set(month, {
      records: cachedRecords,
      version: getSalesCacheVersion()
    });

    return cachedRecords;
  }

  // 3. 从 Supabase 分页读取
  console.log(`从 Supabase 读取：${month}`);

  const records = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await client
      .from(SALES_TABLE)
      .select(`
        id,
        sale_date,
        month,
        product_name,
        variant,
        sales
      `)
      .eq("month", month)
      .order("sale_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    records.push(...data.map(normalizeRecord));

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  // 4. 保存读取结果
  const normalizedRecords = records.map(normalizeRecord);

  monthCache.set(month, {
    records: normalizedRecords,
    version: getSalesCacheVersion()
  });

  await saveCachedMonth(month, normalizedRecords);

  console.log(
    `已读取并缓存：${month}，${normalizedRecords.length} 条`
  );

  return normalizedRecords;
}


/* =========================================================
   获取日期范围内的全部数据
========================================================= */

async function loadDateRangeRecords(
  client,
  startDate,
  endDate
) {

  const months =
    getMonthsBetween(
      startDate,
      endDate
    );


  if (!months.length) {
    return [];
  }


  const allRecords = [];


  for (
    const month of months
  ) {

    const records =
      await loadMonthRecords(
        client,
        month
      );


    allRecords.push(
      ...records
    );

  }


  return allRecords.filter(
    record =>
      isDateInRange(
        record.sale_date,
        startDate,
        endDate
      )
  );
}


/* =========================================================
   获取当前已有数据的最新日期
========================================================= */

function getLatestAvailableDate() {

  if (
    currentMonthRecords &&
    currentMonthRecords.length
  ) {

    const dates =
      currentMonthRecords
        .map(
          record =>
            record.sale_date
        )
        .filter(Boolean)
        .sort();


    if (dates.length) {

      return dates[
        dates.length - 1
      ];

    }

  }


  return "";
}


/* =========================================================
   创建刷新按钮
========================================================= */

function createRefreshButton() {

  const status =
    document.getElementById(
      "data-status"
    );


  if (!status) {
    return;
  }


  if (
    document.getElementById(
      "sales-refresh-button"
    )
  ) {

    return;

  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "sales-refresh-button";


  button.type =
    "button";


  button.textContent =
    "↻ 刷新数据";


  button.style.cssText = `
    margin-left: 10px;
    padding: 7px 11px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #ffffff;
    color: #111111;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  `;


  button.addEventListener(
    "mouseenter",
    () => {

      button.style.background =
        "#f7f7f7";

      button.style.borderColor =
        "#d5d5d5";

    }
  );


  button.addEventListener(
    "mouseleave",
    () => {

      button.style.background =
        "#ffffff";

      button.style.borderColor =
        "#e5e5e5";

    }
  );


  button.addEventListener(
    "click",
    async () => {

      await refreshCurrentMonth();

    }
  );


  status.insertAdjacentElement(
    "afterend",
    button
  );
}


/* =========================================================
   手动刷新当前月份
   修复：与普通读取使用相同的稳定分页排序
========================================================= */

async function refreshCurrentMonth() {
  if (!currentMonth) {
    return;
  }

  const monthToRefresh = currentMonth;

  const message = document.getElementById("sales-message");
  const button = document.getElementById("sales-refresh-button");

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "↻ 刷新中...";
      button.style.opacity = "0.6";
      button.style.cursor = "default";
    }

    if (message) {
      message.textContent =
        `正在从 Supabase 刷新 ${monthToRefresh} 数据...`;
    }

    // 删除该月份的旧缓存
    monthCache.delete(monthToRefresh);
    await deleteCachedMonth(monthToRefresh);

    const client = await getSalesClient();

    const records = [];
    let from = 0;

    // 分页读取，排序规则必须与 loadMonthRecords 一致
    while (true) {
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await client
        .from(SALES_TABLE)
        .select(`
          id,
          sale_date,
          month,
          product_name,
          variant,
          sales
        `)
        .eq("month", monthToRefresh)
        .order("sale_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      records.push(...data.map(normalizeRecord));

      if (data.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    const normalizedRecords = records.map(normalizeRecord);

    // 更新内存缓存和 IndexedDB
    monthCache.set(monthToRefresh, {
      records: normalizedRecords,
      version: getSalesCacheVersion()
    });

    await saveCachedMonth(monthToRefresh, normalizedRecords);

    // 只有刷新的是当前选中月份，才更新当前页面数据
    if (currentMonth === monthToRefresh) {
      currentMonthRecords = normalizedRecords;

      if (currentDateRange.type === "month") {
        renderCurrentRange();
      } else {
        await applyCurrentDateRange();
      }
    }

    if (message) {
      message.textContent =
        `${monthToRefresh} 数据刷新完成，共 ${normalizedRecords.length} 条记录`;
    }

    console.log(
      `${monthToRefresh} 刷新完成，共 ${normalizedRecords.length} 条记录`
    );
  } catch (error) {
    console.error("刷新销量数据失败：", error);

    if (message) {
      message.textContent =
        `刷新失败：${error.message || error}`;
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "↻ 刷新数据";
      button.style.opacity = "1";
      button.style.cursor = "pointer";
    }
  }
}


/* =========================================================
   自动检测数据库更新
========================================================= */

async function checkSalesDataVersion() {

  if (isAutoRefreshing) {
    return;
  }


  const currentVersion =
    getSalesCacheVersion();


  /*
    第一次没有版本号，
    只记录，不做任何动作。
  */

  if (!currentVersion) {
    return;
  }


  /*
    版本没有变化
  */

  if (
    currentVersion ===
    lastKnownSalesCacheVersion
  ) {

    return;

  }


  /*
    发现数据库已经更新
  */

  console.log(
    "检测到销量数据版本更新：",
    lastKnownSalesCacheVersion,
    "→",
    currentVersion
  );


  lastKnownSalesCacheVersion =
    currentVersion;


  await autoRefreshAfterDataUpdate();
}


/* =========================================================
   数据库更新后的自动刷新
========================================================= */

async function autoRefreshAfterDataUpdate() {

  if (isAutoRefreshing) {
    return;
  }


  isAutoRefreshing = true;


  const message =
    document.getElementById(
      "sales-message"
    );


  const button =
    document.getElementById(
      "sales-refresh-button"
    );


  try {

    if (message) {

      message.textContent =
        "检测到销量数据更新，正在自动同步最新数据...";

    }


    setDataStatus(
      "自动更新中"
    );


    /*
      清掉内存缓存。

      IndexedDB 中的旧缓存
      因为 version 不一致也会自动失效。
    */

    monthCache.clear();


    const client =
      await getSalesClient();


    /*
      重新获取月份范围。

      这样如果 Excel 导入后
      新增了一个月份，也能自动出现。
    */

    allMonths =
      await loadMonthRange(
        client
      );


    renderMonthOptions();


    /*
      如果当前月份已经不存在，
      自动切换到最新月份。
    */

    if (
      !allMonths.includes(
        currentMonth
      )
    ) {

      currentMonth =
        allMonths[0] || "";

    }


    if (!currentMonth) {

      currentMonthRecords =
        [];

      renderCurrentRange();

      if (message) {

        message.textContent =
          "暂无销量数据";

      }

      return;
    }


    const monthSelect =
      document.getElementById(
        "month-select"
      );


    if (monthSelect) {

      monthSelect.value =
        currentMonth;

    }


    /*
      重新应用当前时间范围。

      月份模式：
        重新读取当前月份

      7天 / 30天 / 自定义：
        重新读取对应范围
    */

    if (
      currentDateRange.type ===
      "month"
    ) {

      await switchMonth(
        currentMonth
      );

    } else {

      await applyCurrentDateRange();

    }


    if (message) {

      message.textContent =
        "销量数据已自动更新";

    }


    console.log(
      "销量数据自动更新完成"
    );


  } catch (error) {

    console.error(
      "自动更新销量数据失败：",
      error
    );


    if (message) {

      message.textContent =
        `自动更新失败：${
          error.message || error
        }`;

    }


    setDataStatus(
      "自动更新失败"
    );


  } finally {

    isAutoRefreshing =
      false;

  }
}


/* =========================================================
   监听其他页面 / 标签页的 localStorage 更新
========================================================= */

function setupSalesVersionStorageListener() {

  window.addEventListener(
    "storage",
    event => {

      if (
        event.key !==
        SALES_CACHE_VERSION_KEY
      ) {

        return;

      }


      const newVersion =
        event.newValue || "";


      if (
        !newVersion ||
        newVersion ===
        lastKnownSalesCacheVersion
      ) {

        return;

      }


      console.log(
        "检测到其他页面更新销量数据"
      );


      lastKnownSalesCacheVersion =
        newVersion;


      autoRefreshAfterDataUpdate();

    }
  );
}


/* =========================================================
   设置自动检测定时器
========================================================= */

function setupAutoUpdateChecker() {

  /*
    页面打开后定时检查。

    这样即使：
    - 销量数据页面一直开着
    - 你切到销量数据导入页面
    - 上传 Excel
    - 导入成功
    - 再切回来

    也会自动检测。
  */

  setInterval(
    () => {

      checkSalesDataVersion();

    },
    AUTO_CHECK_INTERVAL
  );
}


/* =========================================================
   月份下拉框
========================================================= */

function renderMonthOptions() {

  const select =
    document.getElementById(
      "month-select"
    );


  if (!select) {
    return;
  }


  select.innerHTML = "";


  if (!allMonths.length) {

    const option =
      document.createElement(
        "option"
      );


    option.value = "";

    option.textContent =
      "暂无数据";


    select.appendChild(
      option
    );


    return;
  }


  allMonths.forEach(
    month => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        month;


      const [
        year,
        monthNumber
      ] =
        month.split("-");


      option.textContent =
        `${year}年${Number(monthNumber)}月`;


      select.appendChild(
        option
      );

    }
  );


  if (currentMonth) {

    select.value =
      currentMonth;

  }
}


/* =========================================================
   设置数据状态
========================================================= */

function setDataStatus(
  text
) {

  const status =
    document.getElementById(
      "data-status"
    );


  if (status) {

    status.textContent =
      text;

  }
}


/* =========================================================
   设置当前范围按钮状态
========================================================= */

function updateRangeButtonState(
  type
) {

  const buttons = [
    "last-7-days",
    "last-30-days",
    "custom-date-button"
  ];


  buttons.forEach(
    id => {

      const button =
        document.getElementById(
          id
        );


      if (!button) {
        return;
      }


      button.classList.remove(
        "active"
      );

    }
  );


  let activeId = "";


  if (
    type === "last7"
  ) {

    activeId =
      "last-7-days";

  }


  if (
    type === "last30"
  ) {

    activeId =
      "last-30-days";

  }


  if (
    type === "custom"
  ) {

    activeId =
      "custom-date-button";

  }


  if (activeId) {

    const button =
      document.getElementById(
        activeId
      );


    if (button) {

      button.classList.add(
        "active"
      );

    }

  }
}


/* =========================================================
   月度概览
========================================================= */

function renderOverview(
  records,
  month,
  rangeStart = null,
  rangeEnd = null
) {

  const monthSales =
    records.reduce(
      (
        sum,
        record
      ) =>
        sum +
        Number(
          record.sales || 0
        ),
      0
    );


  const products =
    new Set();


  const variants =
    new Set();


  records.forEach(
    record => {

      if (
        record.product_name
      ) {

        products.add(
          record.product_name
        );

      }


      if (
        record.variant
      ) {

        variants.add(
          `${record.product_name}||${record.variant}`
        );

      }

    }
  );


  let daysCount = 0;


  if (
    rangeStart &&
    rangeEnd
  ) {

    daysCount =
      generateDateRange(
        rangeStart,
        rangeEnd
      ).length;

  } else {

    const parsedMonth =
      parseMonth(month);


    if (parsedMonth) {

      daysCount =
        new Date(
          parsedMonth.year,
          parsedMonth.month,
          0
        ).getDate();

    }

  }


  const averageDailySales =
    daysCount > 0
      ? monthSales / daysCount
      : 0;


  const monthSalesElement =
    document.getElementById(
      "month-sales"
    );


  const monthProductsElement =
    document.getElementById(
      "month-products"
    );


  const monthVariantsElement =
    document.getElementById(
      "month-variants"
    );


  const averageElement =
    document.getElementById(
      "average-daily-sales"
    );


  const overviewMonth =
    document.getElementById(
      "overview-month"
    );


  if (monthSalesElement) {

    monthSalesElement.textContent =
      formatNumber(
        monthSales
      );

  }


  if (monthProductsElement) {

    monthProductsElement.textContent =
      formatNumber(
        products.size
      );

  }


  if (monthVariantsElement) {

    monthVariantsElement.textContent =
      formatNumber(
        variants.size
      );

  }


  if (averageElement) {

    averageElement.textContent =
      formatNumber(
        Math.round(
          averageDailySales
        )
      );

  }


  if (overviewMonth) {

    if (
      rangeStart &&
      rangeEnd
    ) {

      if (
        rangeStart === rangeEnd
      ) {

        overviewMonth.textContent =
          formatDate(
            rangeStart
          );

      } else {

        overviewMonth.textContent =
          `${formatDate(
            rangeStart
          )} → ${formatDate(
            rangeEnd
          )}`;

      }

    } else {

      const parsedMonth =
        parseMonth(month);


      if (parsedMonth) {

        overviewMonth.textContent =
          `${parsedMonth.year}年${parsedMonth.month}月`;

      } else {

        overviewMonth.textContent =
          month || "暂无数据";

      }

    }

  }


  setDataStatus(
    `${formatNumber(
      records.length
    )} 条记录`
  );
}


/* =========================================================
   每日销量
========================================================= */

function aggregateDaily(
  records
) {

  const daily =
    new Map();


  records.forEach(
    record => {

      const date =
        record.sale_date;


      if (!date) {
        return;
      }


      daily.set(
        date,
        (
          daily.get(date) || 0
        ) +
        Number(
          record.sales || 0
        )
      );

    }
  );


  return daily;
}


function createDailySeries(
  records,
  rangeStart = null,
  rangeEnd = null
) {

  const daily =
    aggregateDaily(
      records
    );


  /*
    如果明确传入了时间范围，
    图表完整显示整个范围。

    即使某一天销量为 0，
    也会显示出来。
  */

  if (
    rangeStart &&
    rangeEnd
  ) {

    const allDates =
      generateDateRange(
        rangeStart,
        rangeEnd
      );


    return allDates.map(
      date => ({

        date,

        sales:
          daily.get(date) || 0

      })
    );

  }


  if (!records.length) {
    return [];
  }


  const dates =
    [...daily.keys()].sort();


  if (!dates.length) {
    return [];
  }


  const startDate =
    dates[0];


  const endDate =
    dates[
      dates.length - 1
    ];


  const allDates =
    generateDateRange(
      startDate,
      endDate
    );


  return allDates.map(
    date => ({

      date,

      sales:
        daily.get(date) || 0

    })
  );
}


/* =========================================================
   产品
========================================================= */

function getProducts(
  records
) {

  const products =
    new Set();


  records.forEach(
    record => {

      if (
        record.product_name
      ) {

        products.add(
          record.product_name
        );

      }

    }
  );


  return [
    ...products
  ].sort(
    (a, b) =>
      naturalSort(a, b)
  );
}


function createProductSeries(
  records,
  productName
) {

  const filtered =
    records.filter(
      record =>
        record.product_name ===
        productName
    );


  return createDailySeries(
    filtered,
    currentDateRange.start,
    currentDateRange.end
  );
}


/* =========================================================
   Variant 解析
========================================================= */

function parseVariant(
  variant
) {

  const value =
    String(
      variant || ""
    ).trim();


  if (!value) {

    return {
      color:
        "未填写颜色",

      size:
        "未填写尺码"
    };

  }


  /*
    数字尺码

    纯黑41
    午夜蓝42
    黑色火焰9
    黑色火焰9.5
  */

  const numberMatch =
    value.match(
      /^(.*?)(\d+(?:\.\d+)?)$/
    );


  if (numberMatch) {

    const color =
      numberMatch[1].trim();


    const size =
      numberMatch[2].trim();


    if (color) {

      return {
        color,
        size
      };

    }

  }


  /*
    字母尺码

    灰色M
    灰色L
    黑色XL
  */

  const letterMatch =
    value.match(
      /^(.*?)(XXXL|XXL|XXS|XS|XL|3XL|2XL|S|M|L)$/i
    );


  if (letterMatch) {

    const color =
      letterMatch[1].trim();


    const size =
      letterMatch[2].trim();


    if (color) {

      return {
        color,
        size
      };

    }

  }


  return {
    color:
      value,

    size:
      "未识别尺码"
  };
}


/* =========================================================
   获取颜色
========================================================= */

function getColors(
  records,
  productName
) {

  const colors =
    new Set();


  records

    .filter(
      record =>
        record.product_name ===
        productName
    )

    .forEach(
      record => {

        const parsed =
          parseVariant(
            record.variant
          );


        colors.add(
          parsed.color
        );

      }
    );


  return [
    ...colors
  ].sort(
    (a, b) =>
      naturalSort(a, b)
  );
}


/* =========================================================
   获取尺码
========================================================= */

function getSizes(
  records,
  productName,
  color
) {

  const sizes =
    new Set();


  records

    .filter(
      record =>
        record.product_name ===
        productName
    )

    .forEach(
      record => {

        const parsed =
          parseVariant(
            record.variant
          );


        if (
          parsed.color ===
          color
        ) {

          sizes.add(
            parsed.size
          );

        }

      }
    );


  return [
    ...sizes
  ].sort(
    (a, b) =>
      sizeSort(a, b)
  );
}


/* =========================================================
   产品 + 颜色
========================================================= */

function createColorSeries(
  records,
  productName,
  color
) {

  const filtered =
    records.filter(
      record => {

        if (
          record.product_name !==
          productName
        ) {

          return false;

        }


        const parsed =
          parseVariant(
            record.variant
          );


        return (
          parsed.color ===
          color
        );

      }
    );


  return createDailySeries(
    filtered,
    currentDateRange.start,
    currentDateRange.end
  );
}


/* =========================================================
   产品 + 颜色 + 尺码
========================================================= */

function createSizeSeries(
  records,
  productName,
  color,
  size
) {

  const filtered =
    records.filter(
      record => {

        if (
          record.product_name !==
          productName
        ) {

          return false;

        }


        const parsed =
          parseVariant(
            record.variant
          );


        return (
          parsed.color ===
            color &&
          parsed.size ===
            size
        );

      }
    );


  return createDailySeries(
    filtered,
    currentDateRange.start,
    currentDateRange.end
  );
}


/* =========================================================
   产品下拉框
========================================================= */

function populateProductSelects(
  records
) {

  const productSelect =
    document.getElementById(
      "product-select"
    );


  const variantProductSelect =
    document.getElementById(
      "variant-product-select"
    );


  const products =
    getProducts(
      records
    );


  /*
    产品趋势
  */

  if (productSelect) {

    productSelect.innerHTML =
      "";


    const defaultOption =
      document.createElement(
        "option"
      );


    defaultOption.value =
      "";


    defaultOption.textContent =
      "请选择产品";


    productSelect.appendChild(
      defaultOption
    );


    products.forEach(
      product => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          product;


        option.textContent =
          product;


        productSelect.appendChild(
          option
        );

      }
    );

  }


  /*
    Variant 产品
  */

  if (
    variantProductSelect
  ) {

    variantProductSelect.innerHTML =
      "";


    const defaultOption =
      document.createElement(
        "option"
      );


    defaultOption.value =
      "";


    defaultOption.textContent =
      "请选择产品";


    variantProductSelect.appendChild(
      defaultOption
    );


    products.forEach(
      product => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          product;


        option.textContent =
          product;


        variantProductSelect.appendChild(
          option
        );

      }
    );

  }
}


/* =========================================================
   颜色下拉框
========================================================= */

function populateColorSelect(
  productName
) {

  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  const chart =
    document.getElementById(
      "variant-chart"
    );


  if (!colorSelect) {
    return;
  }


  colorSelect.innerHTML =
    "";


  const defaultOption =
    document.createElement(
      "option"
    );


  defaultOption.value =
    "";


  defaultOption.textContent =
    productName
      ? "请选择颜色"
      : "请先选择产品";


  colorSelect.appendChild(
    defaultOption
  );


  if (!productName) {

    colorSelect.disabled =
      true;


    if (sizeSelect) {

      sizeSelect.innerHTML =
        "";


      const option =
        document.createElement(
          "option"
        );


      option.value =
        "";


      option.textContent =
        "请先选择颜色";


      sizeSelect.appendChild(
        option
      );


      sizeSelect.disabled =
        true;

    }


    if (chart) {

      chart.classList.add(
        "chart-hidden"
      );


      chart.innerHTML =
        '<div class="chart-empty">请选择产品和颜色</div>';

    }


    return;
  }


  const colors =
    getColors(
      currentMonthRecords,
      productName
    );


  colors.forEach(
    color => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        color;


      option.textContent =
        color;


      colorSelect.appendChild(
        option
      );

    }
  );


  colorSelect.disabled =
    colors.length === 0;


  if (sizeSelect) {

    sizeSelect.innerHTML =
      "";


    const option =
      document.createElement(
        "option"
      );


    option.value =
      "";


    option.textContent =
      "请先选择颜色";


    sizeSelect.appendChild(
      option
    );


    sizeSelect.disabled =
      true;

  }


  if (chart) {

    chart.classList.add(
      "chart-hidden"
    );


    chart.innerHTML =
      '<div class="chart-empty">请选择产品和颜色</div>';

  }
}


/* =========================================================
   尺码下拉框
========================================================= */

function populateSizeSelect(
  productName,
  color
) {

  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (!sizeSelect) {
    return;
  }


  sizeSelect.innerHTML =
    "";


  const defaultOption =
    document.createElement(
      "option"
    );


  defaultOption.value =
    "";


  defaultOption.textContent =
    color
      ? "请选择尺码"
      : "请先选择颜色";


  sizeSelect.appendChild(
    defaultOption
  );


  if (
    !productName ||
    !color
  ) {

    sizeSelect.disabled =
      true;


    return;
  }


  const sizes =
    getSizes(
      currentMonthRecords,
      productName,
      color
    );


  sizes.forEach(
    size => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        size;


      option.textContent =
        size;


      sizeSelect.appendChild(
        option
      );

    }
  );


  sizeSelect.disabled =
    sizes.length === 0;
}


/* =========================================================
   趋势图
========================================================= */

function renderTrendChart(
  containerId,
  series,
  emptyText = "暂无数据"
) {

  const container =
    document.getElementById(
      containerId
    );


  if (!container) {
    return;
  }


  if (
    !series ||
    !series.length
  ) {

    container.classList.remove(
      "chart-hidden"
    );


    container.innerHTML =
      `<div class="chart-empty">${emptyText}</div>`;


    return;
  }


  container.classList.remove(
    "chart-hidden"
  );


  const width = 1000;

  const height = 360;


  const padding = {

    top: 35,

    right: 35,

    bottom: 55,

    left: 60

  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  const values =
    series.map(
      item =>
        Number(
          item.sales || 0
        )
    );


  const maxValue =
    Math.max(
      ...values,
      1
    );


  const pointCount =
    series.length;


  const getX =
    index => {

      if (
        pointCount === 1
      ) {

        return (
          padding.left +
          chartWidth / 2
        );

      }


      return (
        padding.left +
        (
          index /
          (
            pointCount - 1
          )
        ) *
        chartWidth
      );

    };


  const getY =
    value => {

      return (
        padding.top +
        chartHeight -
        (
          value /
          maxValue
        ) *
        chartHeight
      );

    };


  const points =
    series.map(
      (
        item,
        index
      ) => ({

        ...item,

        x:
          getX(index),

        y:
          getY(
            Number(
              item.sales || 0
            )
          )

      })
    );


  /*
    折线
  */

  let linePath = "";


  points.forEach(
    (
      point,
      index
    ) => {

      linePath +=
        `${
          index === 0
            ? "M"
            : "L"
        } ${point.x} ${point.y} `;

    }
  );


  /*
    面积
  */

  let areaPath =
    `M ${points[0].x} ${
      padding.top +
      chartHeight
    } `;


  points.forEach(
    point => {

      areaPath +=
        `L ${point.x} ${point.y} `;

    }
  );


  areaPath +=
    `L ${
      points[
        points.length - 1
      ].x
    } ${
      padding.top +
      chartHeight
    } Z`;


  /*
    网格
  */

  let gridLines = "";

  const gridCount = 5;


  for (
    let i = 0;
    i <= gridCount;
    i++
  ) {

    const y =
      padding.top +
      (
        i /
        gridCount
      ) *
      chartHeight;


    const value =
      maxValue -
      (
        i /
        gridCount
      ) *
      maxValue;


    gridLines += `
      <line
        x1="${padding.left}"
        y1="${y}"
        x2="${padding.left + chartWidth}"
        y2="${y}"
        class="sales-chart-grid"
      />

      <text
        x="${padding.left - 10}"
        y="${y + 4}"
        text-anchor="end"
        class="sales-chart-label"
      >
        ${formatNumber(
          Math.round(value)
        )}
      </text>
    `;

  }


  /*
    X轴日期
  */

  let labels = "";

  const maxLabels = 8;


  const step =
    Math.max(
      1,
      Math.ceil(
        pointCount /
        maxLabels
      )
    );


  points.forEach(
    (
      point,
      index
    ) => {

      if (
        index % step === 0 ||
        index ===
          pointCount - 1
      ) {

        labels += `
          <text
            x="${point.x}"
            y="${height - 18}"
            text-anchor="middle"
            class="sales-chart-label"
          >
            ${formatDate(
              point.date
            )}
          </text>
        `;

      }

    }
  );


  /*
    数据点
  */

  const pointElements =
    points
      .map(
        point => `
          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="4"
            class="sales-chart-point"
          />
        `
      )
      .join("");


  /*
    垂直辅助线
  */

  const verticalLine = `
    <line
      id="${containerId}-hover-line"
      x1="0"
      y1="${padding.top}"
      x2="0"
      y2="${padding.top + chartHeight}"
      class="sales-chart-hover-line"
      style="display:none;"
    />
  `;


  /*
    透明鼠标捕获区域
  */

  const hoverArea = `
    <rect
      x="${padding.left}"
      y="${padding.top}"
      width="${chartWidth}"
      height="${chartHeight}"
      fill="transparent"
      class="sales-chart-hover-area"
    />
  `;


  container.innerHTML = `

    <div class="chart-filter-info">

      <span>
        数据点：${formatNumber(
          series.length
        )}
      </span>

      <span>
        总销量：${formatNumber(
          values.reduce(
            (
              sum,
              value
            ) =>
              sum + value,
            0
          )
        )}
      </span>

    </div>


    <div
      class="chart-wrapper"
      style="position:relative;"
    >

      <svg
        class="sales-chart-svg"
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
      >

        ${gridLines}

        <path
          d="${areaPath}"
          class="sales-chart-area"
        />

        <path
          d="${linePath}"
          class="sales-chart-line"
        />

        ${verticalLine}

        ${pointElements}

        ${labels}

        ${hoverArea}

      </svg>


      <div
        class="chart-tooltip"
        id="${containerId}-tooltip"
      >

        <div
          class="chart-tooltip-date"
        ></div>

        <div
          class="chart-tooltip-sales"
        ></div>

      </div>

    </div>

  `;


  const tooltip =
    document.getElementById(
      `${containerId}-tooltip`
    );


  const svg =
    container.querySelector(
      ".sales-chart-svg"
    );


  const hoverAreaElement =
    container.querySelector(
      ".sales-chart-hover-area"
    );


  const hoverLine =
    document.getElementById(
      `${containerId}-hover-line`
    );


  if (
    !tooltip ||
    !svg ||
    !hoverAreaElement ||
    !hoverLine
  ) {

    return;

  }


  /*
    鼠标移动
  */

  hoverAreaElement.addEventListener(
    "mousemove",
    event => {

      const rect =
        svg.getBoundingClientRect();


      const mouseX =
        event.clientX -
        rect.left;


      const scaleX =
        width /
        rect.width;


      const svgX =
        mouseX *
        scaleX;


      const chartX =
        Math.max(
          padding.left,
          Math.min(
            padding.left +
              chartWidth,
            svgX
          )
        );


      let nearestPoint =
        points[0];


      let nearestDistance =
        Math.abs(
          points[0].x -
          chartX
        );


      points.forEach(
        point => {

          const distance =
            Math.abs(
              point.x -
              chartX
            );


          if (
            distance <
            nearestDistance
          ) {

            nearestPoint =
              point;

            nearestDistance =
              distance;

          }

        }
      );


      /*
        垂直线
      */

      hoverLine.setAttribute(
        "x1",
        nearestPoint.x
      );


      hoverLine.setAttribute(
        "x2",
        nearestPoint.x
      );


      hoverLine.style.display =
        "block";


      /*
        高亮圆点
      */

      const circles =
        container.querySelectorAll(
          ".sales-chart-point"
        );


      circles.forEach(
        circle => {

          circle.classList.remove(
            "is-active"
          );

        }
      );


      const pointIndex =
        points.indexOf(
          nearestPoint
        );


      if (
        circles[pointIndex]
      ) {

        circles[
          pointIndex
        ].classList.add(
          "is-active"
        );

      }


      /*
        Tooltip
      */

      tooltip.querySelector(
        ".chart-tooltip-date"
      ).textContent =
        formatDate(
          nearestPoint.date
        );


      tooltip.querySelector(
        ".chart-tooltip-sales"
      ).textContent =
        `${formatNumber(
          nearestPoint.sales
        )} 件`;


      /*
        Tooltip位置
      */

      const tooltipX =
        (
          nearestPoint.x /
          width
        ) *
        rect.width;


      const tooltipY =
        (
          nearestPoint.y /
          height
        ) *
        rect.height;


      const tooltipWidth =
        tooltip.offsetWidth ||
        100;


      const halfTooltip =
        tooltipWidth / 2;


      let finalLeft =
        tooltipX;


      const minLeft =
        halfTooltip + 5;


      const maxLeft =
        rect.width -
        halfTooltip -
        5;


      finalLeft =
        Math.max(
          minLeft,
          Math.min(
            maxLeft,
            finalLeft
          )
        );


      tooltip.style.left =
        `${finalLeft}px`;


      tooltip.style.top =
        `${Math.max(
          10,
          tooltipY - 12
        )}px`;


      tooltip.classList.add(
        "is-visible"
      );

    }
  );


  /*
    鼠标离开
  */

  hoverAreaElement.addEventListener(
    "mouseleave",
    () => {

      tooltip.classList.remove(
        "is-visible"
      );


      hoverLine.style.display =
        "none";


      const circles =
        container.querySelectorAll(
          ".sales-chart-point"
        );


      circles.forEach(
        circle => {

          circle.classList.remove(
            "is-active"
          );

        }
      );

    }
  );

}


/* =========================================================
   每日趋势
========================================================= */

function renderDailyChart(
  records
) {

  const series =
    createDailySeries(
      records,
      currentDateRange.start,
      currentDateRange.end
    );


  dailyChartState =
    series;


  renderTrendChart(
    "daily-chart",
    series,
    "暂无每日销量数据"
  );
}


/* =========================================================
   产品趋势
========================================================= */

function renderProductChart(
  productName
) {

  if (!productName) {

    const container =
      document.getElementById(
        "product-chart"
      );


    if (container) {

      container.classList.add(
        "chart-hidden"
      );


      container.innerHTML =
        '<div class="chart-empty">请选择产品</div>';

    }


    return;
  }


  const series =
    createProductSeries(
      currentMonthRecords,
      productName
    );


  productChartState =
    series;


  renderTrendChart(
    "product-chart",
    series,
    "该产品暂无销量数据"
  );
}


/* =========================================================
   颜色趋势
========================================================= */

function renderColorChart(
  productName,
  color
) {

  if (
    !productName ||
    !color
  ) {

    const container =
      document.getElementById(
        "variant-chart"
      );


    if (container) {

      container.classList.add(
        "chart-hidden"
      );


      container.innerHTML =
        '<div class="chart-empty">请选择产品和颜色</div>';

    }


    return;
  }


  const series =
    createColorSeries(
      currentMonthRecords,
      productName,
      color
    );


  variantChartState =
    series;


  renderTrendChart(
    "variant-chart",
    series,
    "该颜色暂无销量数据"
  );
}


/* =========================================================
   尺码趋势
========================================================= */

function renderSizeChart(
  productName,
  color,
  size
) {

  if (
    !productName ||
    !color ||
    !size
  ) {

    return;

  }


  const series =
    createSizeSeries(
      currentMonthRecords,
      productName,
      color,
      size
    );


  variantChartState =
    series;


  renderTrendChart(
    "variant-chart",
    series,
    "该尺码暂无销量数据"
  );
}


/* =========================================================
   重置筛选
========================================================= */

function resetProductAndVariantFilters() {

  const productSelect =
    document.getElementById(
      "product-select"
    );


  const variantProductSelect =
    document.getElementById(
      "variant-product-select"
    );


  if (productSelect) {

    productSelect.value =
      "";

  }


  if (
    variantProductSelect
  ) {

    variantProductSelect.value =
      "";

  }


  populateColorSelect(
    ""
  );


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (colorSelect) {

    colorSelect.value =
      "";

  }


  if (sizeSelect) {

    sizeSelect.value =
      "";

  }


  const productChart =
    document.getElementById(
      "product-chart"
    );


  if (productChart) {

    productChart.classList.add(
      "chart-hidden"
    );


    productChart.innerHTML =
      '<div class="chart-empty">请选择产品</div>';

  }


  const variantChart =
    document.getElementById(
      "variant-chart"
    );


  if (variantChart) {

    variantChart.classList.add(
      "chart-hidden"
    );


    variantChart.innerHTML =
      '<div class="chart-empty">请选择产品和颜色</div>';

  }
}


/* =========================================================
   渲染当前范围
========================================================= */

function renderCurrentRange() {

  const records =
    currentMonthRecords;


  renderOverview(
    records,
    currentMonth,
    currentDateRange.start,
    currentDateRange.end
  );


  renderDailyChart(
    records
  );


  populateProductSelects(
    records
  );


  resetProductAndVariantFilters();
}


/* =========================================================
   应用日期范围
========================================================= */

async function applyDateRange(
  startDate,
  endDate,
  type
) {

  if (
    !startDate ||
    !endDate
  ) {

    return;

  }


  if (
    startDate >
    endDate
  ) {

    const temp =
      startDate;

    startDate =
      endDate;

    endDate =
      temp;

  }


  const message =
    document.getElementById(
      "sales-message"
    );


  try {

    if (message) {

      message.textContent =
        `正在读取 ${formatDate(
          startDate
        )} → ${formatDate(
          endDate
        )} 销量数据...`;

    }


    setDataStatus(
      "读取中"
    );


    const client =
      await getSalesClient();


    const records =
      await loadDateRangeRecords(
        client,
        startDate,
        endDate
      );


    currentDateRange = {

      type,

      start:
        startDate,

      end:
        endDate

    };


    currentMonthRecords =
      records;


    /*
      快捷日期跨月份时，
      下拉框跟随结束日期所在月份。
    */

    const endMonth =
      getMonthFromDate(
        endDate
      );


    if (
      endMonth &&
      allMonths.includes(
        endMonth
      )
    ) {

      currentMonth =
        endMonth;


      const monthSelect =
        document.getElementById(
          "month-select"
        );


      if (monthSelect) {

        monthSelect.value =
          endMonth;

      }

    }


    renderOverview(
      records,
      currentMonth,
      startDate,
      endDate
    );


    renderDailyChart(
      records
    );


    populateProductSelects(
      records
    );


    resetProductAndVariantFilters();


    updateRangeButtonState(
      type
    );


    if (message) {

      if (type === "last7") {

        message.textContent =
          "近7天数据读取完成";

      } else if (
        type === "last30"
      ) {

        message.textContent =
          "近30天数据读取完成";

      } else if (
        type === "custom"
      ) {

        message.textContent =
          "自定义日期数据读取完成";

      } else {

        message.textContent =
          `${formatDate(
            startDate
          )} → ${formatDate(
            endDate
          )} 数据读取完成`;

      }

    }


  } catch (error) {

    console.error(
      "读取日期范围销量失败：",
      error
    );


    if (message) {

      message.textContent =
        `读取失败：${
          error.message || error
        }`;

    }


    setDataStatus(
      "读取失败"
    );

  }
}


/* =========================================================
   应用当前日期范围
========================================================= */

async function applyCurrentDateRange() {

  if (
    !currentDateRange.start ||
    !currentDateRange.end
  ) {

    renderCurrentRange();

    return;

  }


  await applyDateRange(
    currentDateRange.start,
    currentDateRange.end,
    currentDateRange.type
  );
}


/* =========================================================
   切换月份
========================================================= */

async function switchMonth(
  month
) {

  if (!month) {
    return;
  }


  const message =
    document.getElementById(
      "sales-message"
    );


  try {

    currentMonth =
      month;


    /*
      月份模式
    */

    currentDateRange = {

      type:
        "month",

      start:
        `${month}-01`,

      end:
        `${month}-${String(
          new Date(
            Number(
              month.slice(0, 4)
            ),
            Number(
              month.slice(5, 7)
            ),
            0
          ).getDate()
        ).padStart(2, "0")}`

    };


    updateRangeButtonState(
      "month"
    );


    if (message) {

      message.textContent =
        `正在读取 ${month} 销量数据...`;

    }


    setDataStatus(
      "读取中"
    );


    const client =
      await getSalesClient();


    const records =
      await loadMonthRecords(
        client,
        month
      );


    currentMonthRecords =
      records;


    renderOverview(
      records,
      month
    );


    renderDailyChart(
      records
    );


    populateProductSelects(
      records
    );


    resetProductAndVariantFilters();


    if (message) {

      message.textContent =
        `${month} 数据读取完成`;

    }


  } catch (error) {

    console.error(
      "读取销量数据失败：",
      error
    );


    if (message) {

      message.textContent =
        `读取失败：${
          error.message || error
        }`;

    }


    setDataStatus(
      "读取失败"
    );

  }
}


/* =========================================================
   产品选择
========================================================= */

function handleProductChange() {

  const select =
    document.getElementById(
      "product-select"
    );


  if (!select) {
    return;
  }


  const productName =
    select.value;


  renderProductChart(
    productName
  );


  /*
    同步到 Variant
  */

  const variantProductSelect =
    document.getElementById(
      "variant-product-select"
    );


  if (
    !variantProductSelect
  ) {

    return;

  }


  variantProductSelect.value =
    productName;


  populateColorSelect(
    productName
  );


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (colorSelect) {

    colorSelect.value =
      "";

  }


  if (sizeSelect) {

    sizeSelect.value =
      "";

  }


  const variantChart =
    document.getElementById(
      "variant-chart"
    );


  if (variantChart) {

    variantChart.classList.add(
      "chart-hidden"
    );


    variantChart.innerHTML =
      '<div class="chart-empty">请选择产品和颜色</div>';

  }
}


/* =========================================================
   Variant 产品选择
========================================================= */

function handleVariantProductChange() {

  const productSelect =
    document.getElementById(
      "variant-product-select"
    );


  if (!productSelect) {
    return;
  }


  const productName =
    productSelect.value;


  /*
    反向同步到产品趋势
  */

  const mainProductSelect =
    document.getElementById(
      "product-select"
    );


  if (mainProductSelect) {

    mainProductSelect.value =
      productName;


    renderProductChart(
      productName
    );

  }


  populateColorSelect(
    productName
  );


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (colorSelect) {

    colorSelect.value =
      "";

  }


  if (sizeSelect) {

    sizeSelect.value =
      "";

  }


  const chart =
    document.getElementById(
      "variant-chart"
    );


  if (chart) {

    chart.classList.add(
      "chart-hidden"
    );


    chart.innerHTML =
      '<div class="chart-empty">请选择产品和颜色</div>';

  }
}


/* =========================================================
   Variant 颜色选择
========================================================= */

function handleColorChange() {

  const productSelect =
    document.getElementById(
      "variant-product-select"
    );


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  if (
    !productSelect ||
    !colorSelect
  ) {

    return;

  }


  const productName =
    productSelect.value;


  const color =
    colorSelect.value;


  populateSizeSelect(
    productName,
    color
  );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (sizeSelect) {

    sizeSelect.value =
      "";

  }


  /*
    产品 + 颜色
    = 所有尺码合计
  */

  if (
    productName &&
    color
  ) {

    renderColorChart(
      productName,
      color
    );

  } else {

    const chart =
      document.getElementById(
        "variant-chart"
      );


    if (chart) {

      chart.classList.add(
        "chart-hidden"
      );


      chart.innerHTML =
        '<div class="chart-empty">请选择产品和颜色</div>';

    }

  }
}


/* =========================================================
   Variant 尺码选择
========================================================= */

function handleSizeChange() {

  const productSelect =
    document.getElementById(
      "variant-product-select"
    );


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );


  if (
    !productSelect ||
    !colorSelect ||
    !sizeSelect
  ) {

    return;

  }


  const productName =
    productSelect.value;


  const color =
    colorSelect.value;


  const size =
    sizeSelect.value;


  if (
    productName &&
    color &&
    size
  ) {

    renderSizeChart(
      productName,
      color,
      size
    );

  } else if (
    productName &&
    color
  ) {

    renderColorChart(
      productName,
      color
    );

  }
}


/* =========================================================
   快捷时间范围
========================================================= */

async function getLatestDataDate() {

  /*
    优先使用当前已经读取的数据
  */

  const currentLatest =
    getLatestAvailableDate();


  if (currentLatest) {

    return currentLatest;

  }


  /*
    如果当前没有数据，
    读取最新月份。
  */

  if (
    allMonths.length
  ) {

    const latestMonth =
      allMonths[0];


    const client =
      await getSalesClient();


    const records =
      await loadMonthRecords(
        client,
        latestMonth
      );


    const dates =
      records
        .map(
          record =>
            record.sale_date
        )
        .filter(Boolean)
        .sort();


    if (dates.length) {

      return dates[
        dates.length - 1
      ];

    }

  }


  return "";
}


async function applyLast7Days() {

  const latestDate =
    await getLatestDataDate();


  if (!latestDate) {

    return;

  }


  const startDate =
    addDays(
      latestDate,
      -6
    );


  await applyDateRange(
    startDate,
    latestDate,
    "last7"
  );
}


async function applyLast30Days() {

  const latestDate =
    await getLatestDataDate();


  if (!latestDate) {

    return;

  }


  const startDate =
    addDays(
      latestDate,
      -29
    );


  await applyDateRange(
    startDate,
    latestDate,
    "last30"
  );
}


/* =========================================================
   自定义日期选择器监听
========================================================= */

function setupCustomDateRangeListener() {

  const customButton =
    document.getElementById(
      "custom-date-button"
    );


  if (!customButton) {
    return;
  }


  /*
    你的 sales.html 日期选择器
    在选择完成后会把按钮文字改成：

    2026-08-20 → 2026-09-10

    同时添加 active。

    这里使用 MutationObserver
    监听这个变化。
  */

  let lastText =
    customButton.textContent.trim();


  const observer =
    new MutationObserver(
      async () => {

        const text =
          customButton.textContent.trim();


        if (
          text === lastText
        ) {

          return;

        }


        lastText =
          text;


        const match =
          text.match(
            /^(\d{4}[-/]\d{2}[-/]\d{2})\s*→\s*(\d{4}[-/]\d{2}[-/]\d{2})$/
          );


        if (!match) {

          return;

        }


        const startDate =
          match[1].replace(
            /\//g,
            "-"
          );


        const endDate =
          match[2].replace(
            /\//g,
            "-"
          );


        await applyDateRange(
          startDate,
          endDate,
          "custom"
        );

      }
    );


  observer.observe(
    customButton,
    {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true
    }
  );
}


/* =========================================================
   快捷按钮事件
========================================================= */

function setupRangeButtons() {

  const last7 =
    document.getElementById(
      "last-7-days"
    );


  const last30 =
    document.getElementById(
      "last-30-days"
    );


  if (last7) {

    last7.addEventListener(
      "click",
      async event => {

        event.stopPropagation();

        await applyLast7Days();

      }
    );

  }


  if (last30) {

    last30.addEventListener(
      "click",
      async event => {

        event.stopPropagation();

        await applyLast30Days();

      }
    );

  }
}


/* =========================================================
   初始化
========================================================= */

async function initSalesPage() {

  const message =
    document.getElementById(
      "sales-message"
    );


  try {

    if (message) {

      message.textContent =
        "正在读取销量月份...";

    }


    createRefreshButton();


    setupRangeButtons();


    setupCustomDateRangeListener();


    /*
      启动自动更新检测
    */

    setupSalesVersionStorageListener();

    setupAutoUpdateChecker();


    /*
      记录当前版本
    */

    lastKnownSalesCacheVersion =
      getSalesCacheVersion();


    const client =
      await getSalesClient();


    /*
      月份范围查询
    */

    allMonths =
      await loadMonthRange(
        client
      );


    if (
      !allMonths.length
    ) {

      const monthSelect =
        document.getElementById(
          "month-select"
        );


      if (monthSelect) {

        monthSelect.innerHTML =
          '<option value="">暂无销量数据</option>';

      }


      if (message) {

        message.textContent =
          "暂无销量数据";

      }


      return;

    }


    /*
      默认最新月份
    */

    currentMonth =
      allMonths[0];


    renderMonthOptions();


    const monthSelect =
      document.getElementById(
        "month-select"
      );


    if (monthSelect) {

      monthSelect.value =
        currentMonth;

    }


    /*
      默认显示最新月份
    */

    await switchMonth(
      currentMonth
    );


    /*
      初始化完成后再检查一次版本。

      防止页面加载期间刚好完成 Excel 导入。
    */

    await checkSalesDataVersion();


  } catch (error) {

    console.error(
      "销量页面初始化失败：",
      error
    );


    if (message) {

      message.textContent =
        `初始化失败：${
          error.message || error
        }`;

    }


    setDataStatus(
      "读取失败"
    );

  }
}


/* =========================================================
   页面事件
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const monthSelect =
      document.getElementById(
        "month-select"
      );


    if (monthSelect) {

      monthSelect.addEventListener(
        "change",
        event => {

          switchMonth(
            event.target.value
          );

        }
      );

    }


    const productSelect =
      document.getElementById(
        "product-select"
      );


    if (productSelect) {

      productSelect.addEventListener(
        "change",
        handleProductChange
      );

    }


    const variantProductSelect =
      document.getElementById(
        "variant-product-select"
      );


    if (
      variantProductSelect
    ) {

      variantProductSelect.addEventListener(
        "change",
        handleVariantProductChange
      );

    }


    const colorSelect =
      document.getElementById(
        "variant-color-select"
      );


    if (colorSelect) {

      colorSelect.addEventListener(
        "change",
        handleColorChange
      );

    }


    const sizeSelect =
      document.getElementById(
        "variant-size-select"
      );


    if (sizeSelect) {

      sizeSelect.addEventListener(
        "change",
        handleSizeChange
      );

    }


    initSalesPage();

  }
);