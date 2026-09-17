const SALES_TABLE = "sales_records";
const PAGE_SIZE = 1000;

let allMonths = [];
let currentMonth = "";
let monthCache = new Map();
let currentMonthRecords = [];

let dailyChartState = null;
let productChartState = null;
let variantChartState = null;


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

  const isNumberA = !Number.isNaN(numberA);
  const isNumberB = !Number.isNaN(numberB);

  if (isNumberA && isNumberB) {
    return numberA - numberB;
  }

  if (isNumberA) return -1;
  if (isNumberB) return 1;

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

  const upperA = valueA.toUpperCase();
  const upperB = valueB.toUpperCase();

  const orderA = sizeOrder[upperA];
  const orderB = sizeOrder[upperB];

  if (
    orderA !== undefined &&
    orderB !== undefined
  ) {
    return orderA - orderB;
  }

  if (orderA !== undefined) return -1;
  if (orderB !== undefined) return 1;

  return naturalSort(valueA, valueB);
}


/* =========================================================
   月份
========================================================= */

function parseMonth(month) {
  const match = String(month).match(
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


function generateDateRange(startDate, endDate) {
  const dates = [];

  const start = new Date(
    `${startDate}T00:00:00`
  );

  const end = new Date(
    `${endDate}T00:00:00`
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return dates;
  }

  const current = new Date(start);

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(
      current.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      current.getDate()
    ).padStart(2, "0");

    dates.push(
      `${year}-${month}-${day}`
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
    sale_date: String(
      record.sale_date || ""
    ).slice(0, 10),

    month: String(
      record.month || ""
    ),

    product_name: String(
      record.product_name || ""
    ).trim(),

    variant: String(
      record.variant || ""
    ).trim(),

    sales: Number(
      record.sales || 0
    )
  };
}


/* =========================================================
   Supabase
========================================================= */

async function getSalesClient() {
  if (
    typeof supabaseClient !== "undefined" &&
    supabaseClient
  ) {
    return supabaseClient;
  }

  if (
    typeof window.supabase !== "undefined" &&
    typeof window.SUPABASE_URL !== "undefined"
  ) {
    return window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
  }

  if (
    typeof supabase !== "undefined"
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

async function loadMonthRange(client) {
  const [
    firstResult,
    lastResult
  ] = await Promise.all([
    client
      .from(SALES_TABLE)
      .select("sale_date,month")
      .order("sale_date", {
        ascending: true
      })
      .limit(1)
      .maybeSingle(),

    client
      .from(SALES_TABLE)
      .select("sale_date,month")
      .order("sale_date", {
        ascending: false
      })
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

  let year = first.year;
  let month = first.month;

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
========================================================= */

async function loadMonthRecords(
  client,
  month
) {
  if (monthCache.has(month)) {
    return monthCache.get(month);
  }

  const records = [];

  let from = 0;

  while (true) {
    const to =
      from + PAGE_SIZE - 1;

    const {
      data,
      error
    } = await client
      .from(SALES_TABLE)
      .select(`
        sale_date,
        month,
        product_name,
        variant,
        sales
      `)
      .eq("month", month)
      .order("sale_date", {
        ascending: true
      })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.length === 0
    ) {
      break;
    }

    records.push(
      ...data.map(normalizeRecord)
    );

    if (
      data.length < PAGE_SIZE
    ) {
      break;
    }

    from += PAGE_SIZE;
  }

  monthCache.set(
    month,
    records
  );

  return records;
}


/* =========================================================
   月份下拉框
========================================================= */

function renderMonthOptions() {
  const select =
    document.getElementById(
      "month-select"
    );

  if (!select) return;

  select.innerHTML = "";

  if (!allMonths.length) {
    const option =
      document.createElement(
        "option"
      );

    option.value = "";
    option.textContent =
      "暂无数据";

    select.appendChild(option);

    return;
  }

  allMonths.forEach(month => {
    const option =
      document.createElement(
        "option"
      );

    option.value = month;

    const [
      year,
      monthNumber
    ] = month.split("-");

    option.textContent =
      `${year}年${Number(monthNumber)}月`;

    select.appendChild(option);
  });

  if (currentMonth) {
    select.value =
      currentMonth;
  }
}


/* =========================================================
   月度概览
========================================================= */

function renderOverview(
  records,
  month
) {
  const monthSales =
    records.reduce(
      (sum, record) =>
        sum +
        Number(record.sales || 0),
      0
    );

  const products =
    new Set();

  const variants =
    new Set();

  records.forEach(record => {
    if (record.product_name) {
      products.add(
        record.product_name
      );
    }

    if (record.variant) {
      variants.add(
        `${record.product_name}||${record.variant}`
      );
    }
  });

  const parsedMonth =
    parseMonth(month);

  let daysInMonth = 0;

  if (parsedMonth) {
    daysInMonth =
      new Date(
        parsedMonth.year,
        parsedMonth.month,
        0
      ).getDate();
  }

  const averageDailySales =
    daysInMonth > 0
      ? monthSales / daysInMonth
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
      formatNumber(monthSales);
  }

  if (monthProductsElement) {
    monthProductsElement.textContent =
      formatNumber(products.size);
  }

  if (monthVariantsElement) {
    monthVariantsElement.textContent =
      formatNumber(variants.size);
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
    if (parsedMonth) {
      overviewMonth.textContent =
        `${parsedMonth.year}年${parsedMonth.month}月`;
    } else {
      overviewMonth.textContent =
        month || "暂无数据";
    }
  }

  const status =
    document.getElementById(
      "data-status"
    );

  if (status) {
    status.textContent =
      `${formatNumber(records.length)} 条记录`;
  }
}


/* =========================================================
   每日销量
========================================================= */

function aggregateDaily(records) {
  const daily =
    new Map();

  records.forEach(record => {
    const date =
      record.sale_date;

    if (!date) return;

    daily.set(
      date,
      (
        daily.get(date) || 0
      ) +
      Number(record.sales || 0)
    );
  });

  return daily;
}


function createDailySeries(records) {
  if (!records.length) {
    return [];
  }

  const daily =
    aggregateDaily(records);

  const dates =
    [...daily.keys()].sort();

  if (!dates.length) {
    return [];
  }

  const startDate =
    dates[0];

  const endDate =
    dates[dates.length - 1];

  const allDates =
    generateDateRange(
      startDate,
      endDate
    );

  return allDates.map(date => ({
    date,
    sales:
      daily.get(date) || 0
  }));
}


/* =========================================================
   产品
========================================================= */

function getProducts(records) {
  const products =
    new Set();

  records.forEach(record => {
    if (record.product_name) {
      products.add(
        record.product_name
      );
    }
  });

  return [...products].sort(
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
    filtered
  );
}


/* =========================================================
   Variant 解析
========================================================= */

function parseVariant(variant) {
  const value =
    String(
      variant || ""
    ).trim();

  if (!value) {
    return {
      color: "未填写颜色",
      size: "未填写尺码"
    };
  }


  /* 数字尺码 */

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


  /* 字母尺码 */

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
    color: value,
    size: "未识别尺码"
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
    .forEach(record => {
      const parsed =
        parseVariant(
          record.variant
        );

      colors.add(
        parsed.color
      );
    });

  return [...colors].sort(
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
    .forEach(record => {
      const parsed =
        parseVariant(
          record.variant
        );

      if (
        parsed.color === color
      ) {
        sizes.add(
          parsed.size
        );
      }
    });

  return [...sizes].sort(
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
    records.filter(record => {
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
        parsed.color === color
      );
    });

  return createDailySeries(
    filtered
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
    records.filter(record => {
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
        parsed.color === color &&
        parsed.size === size
      );
    });

  return createDailySeries(
    filtered
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
    getProducts(records);


  /* 产品趋势 */

  if (productSelect) {
    productSelect.innerHTML = "";

    const defaultOption =
      document.createElement(
        "option"
      );

    defaultOption.value = "";
    defaultOption.textContent =
      "请选择产品";

    productSelect.appendChild(
      defaultOption
    );

    products.forEach(product => {
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
    });
  }


  /* Variant 产品 */

  if (variantProductSelect) {
    variantProductSelect.innerHTML = "";

    const defaultOption =
      document.createElement(
        "option"
      );

    defaultOption.value = "";
    defaultOption.textContent =
      "请选择产品";

    variantProductSelect.appendChild(
      defaultOption
    );

    products.forEach(product => {
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
    });
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

  colorSelect.innerHTML = "";

  const defaultOption =
    document.createElement(
      "option"
    );

  defaultOption.value = "";

  defaultOption.textContent =
    productName
      ? "请选择颜色"
      : "请先选择产品";

  colorSelect.appendChild(
    defaultOption
  );


  if (!productName) {
    colorSelect.disabled = true;

    if (sizeSelect) {
      sizeSelect.innerHTML = "";

      const option =
        document.createElement(
          "option"
        );

      option.value = "";
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


  colors.forEach(color => {
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
  });


  colorSelect.disabled =
    colors.length === 0;


  if (sizeSelect) {
    sizeSelect.innerHTML = "";

    const option =
      document.createElement(
        "option"
      );

    option.value = "";
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

  sizeSelect.innerHTML = "";

  const defaultOption =
    document.createElement(
      "option"
    );

  defaultOption.value = "";

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


  sizes.forEach(size => {
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
  });


  sizeSelect.disabled =
    sizes.length === 0;
}


/* =========================================================
   趋势图
   鼠标移动到图表任意位置
   自动吸附最近日期
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
    series.map(item =>
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


  const getX = index => {
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
        (pointCount - 1)
      ) *
      chartWidth
    );
  };


  const getY = value => {
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
      (item, index) => ({
        ...item,

        x: getX(index),

        y: getY(
          Number(
            item.sales || 0
          )
        )
      })
    );


  /* 折线 */

  let linePath = "";

  points.forEach(
    (point, index) => {
      linePath +=
        `${
          index === 0
            ? "M"
            : "L"
        } ${point.x} ${point.y} `;
    }
  );


  /* 面积 */

  let areaPath =
    `M ${points[0].x} ${
      padding.top +
      chartHeight
    } `;

  points.forEach(point => {
    areaPath +=
      `L ${point.x} ${point.y} `;
  });

  areaPath +=
    `L ${
      points[points.length - 1].x
    } ${
      padding.top +
      chartHeight
    } Z`;


  /* 网格 */

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
        i / gridCount
      ) *
      chartHeight;

    const value =
      maxValue -
      (
        i / gridCount
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


  /* X轴日期 */

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
    (point, index) => {
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


  /* 数据点 */

  const pointElements =
    points.map(point => `
      <circle
        cx="${point.x}"
        cy="${point.y}"
        r="4"
        class="sales-chart-point"
      />
    `).join("");


  /*
    垂直辅助线
    默认隐藏
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
    不要求鼠标精准指向圆点
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
            (sum, value) =>
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


  /* =====================================================
     鼠标移动
     根据鼠标 X 位置找到最近日期
  ===================================================== */

  hoverAreaElement.addEventListener(
    "mousemove",
    event => {
      const rect =
        svg.getBoundingClientRect();

      /*
        鼠标相对于 SVG 的位置
      */

      const mouseX =
        event.clientX -
        rect.left;


      /*
        因为 viewBox 是 1000 宽，
        所以需要换算成 SVG 坐标
      */

      const scaleX =
        width /
        rect.width;

      const svgX =
        mouseX * scaleX;


      /*
        限制在图表区域
      */

      const chartX =
        Math.max(
          padding.left,
          Math.min(
            padding.left +
              chartWidth,
            svgX
          )
        );


      /*
        找距离鼠标最近的数据点
      */

      let nearestPoint =
        points[0];

      let nearestDistance =
        Math.abs(
          points[0].x -
          chartX
        );


      points.forEach(point => {
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
      });


      /*
        垂直线跟随最近日期
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
        找到对应圆点
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
        Tooltip 内容
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
        Tooltip 位置
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


      /*
        防止 Tooltip 超出左右边界
      */

      const tooltipWidth =
        tooltip.offsetWidth || 100;

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


  /* =====================================================
     鼠标离开
  ===================================================== */

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
      records
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
    productSelect.value = "";
  }

  if (variantProductSelect) {
    variantProductSelect.value = "";
  }


  populateColorSelect("");


  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );

  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );

  if (colorSelect) {
    colorSelect.value = "";
  }

  if (sizeSelect) {
    sizeSelect.value = "";
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
   切换月份
========================================================= */

async function switchMonth(
  month
) {
  if (!month) return;

  const message =
    document.getElementById(
      "sales-message"
    );

  try {
    currentMonth =
      month;

    if (message) {
      message.textContent =
        `正在读取 ${month} 销量数据...`;
    }


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

    const status =
      document.getElementById(
        "data-status"
      );

    if (status) {
      status.textContent =
        "读取失败";
    }
  }
}


/* =========================================================
   产品选择
   同步 Variant 产品
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


  /* 产品趋势 */

  renderProductChart(
    productName
  );


  /*
    同步到 Variant 产品
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


  /*
    同步后自动刷新颜色
  */

  populateColorSelect(
    productName
  );


  /*
    每次换产品，
    颜色和尺码重新选择
  */

  const colorSelect =
    document.getElementById(
      "variant-color-select"
    );

  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );

  if (colorSelect) {
    colorSelect.value = "";
  }

  if (sizeSelect) {
    sizeSelect.value = "";
  }


  /*
    Variant 图表清空
  */

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
    反向同步到上面的产品趋势
  */

  const mainProductSelect =
    document.getElementById(
      "product-select"
    );

  if (
    mainProductSelect
  ) {
    mainProductSelect.value =
      productName;

    renderProductChart(
      productName
    );
  }


  /*
    根据产品刷新颜色
  */

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
    colorSelect.value = "";
  }

  if (sizeSelect) {
    sizeSelect.value = "";
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


  /*
    根据颜色刷新尺码
  */

  populateSizeSelect(
    productName,
    color
  );


  const sizeSelect =
    document.getElementById(
      "variant-size-select"
    );

  if (sizeSelect) {
    sizeSelect.value = "";
  }


  /*
    产品 + 颜色
    = 该颜色所有尺码合计
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


    const client =
      await getSalesClient();

    allMonths =
      await loadMonthRange(
        client
      );


    if (!allMonths.length) {
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


    await switchMonth(
      currentMonth
    );

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

    const status =
      document.getElementById(
        "data-status"
      );

    if (status) {
      status.textContent =
        "读取失败";
    }
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

    if (variantProductSelect) {
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