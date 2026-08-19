// =====================================================
// shop-data.js
// TikTok Shop 店铺数据
// 完整最终版
// =====================================================

console.log("shop-data.js 开始加载");


// =====================================================
// 全局变量
// =====================================================

let allShopData = [];

let filteredShopData = [];

let selectedStartDate = null;

let selectedEndDate = null;

let tempStartDate = null;

let tempEndDate = null;

let hoverDate = null;

let currentCalendarDate = new Date();


// =====================================================
// 页面初始化
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initShopDataPage();

    }
);


// =====================================================
// 初始化
// =====================================================

async function initShopDataPage() {

    bindUploadEvents();

    bindDatePickerEvents();

    bindQueryEvents();

    await loadShopData();

}


// =====================================================
// 获取 Supabase Client
// =====================================================

function getSupabaseClient() {

    if (
        window.supabaseClient
    ) {

        return window.supabaseClient;

    }


    if (
        window.supabase &&
        window.supabase.from
    ) {

        return window.supabase;

    }


    console.error(
        "Supabase Client 不存在"
    );


    return null;

}


// =====================================================
// Excel 上传事件
// =====================================================

function bindUploadEvents() {

    const fileInput =
        document.getElementById(
            "excelFile"
        );


    const uploadBtn =
        document.getElementById(
            "uploadBtn"
        );


    if (
        fileInput
    ) {

        fileInput.addEventListener(
            "change",
            function () {

                const selectedFile =
                    document.getElementById(
                        "selectedFile"
                    );


                if (
                    fileInput.files &&
                    fileInput.files.length > 0
                ) {

                    selectedFile.textContent =
                        fileInput.files[0].name;

                }
                else {

                    selectedFile.textContent =
                        "尚未选择文件";

                }

            }
        );

    }


    if (
        uploadBtn
    ) {

        uploadBtn.addEventListener(
            "click",
            handleExcelUpload
        );

    }

}


// =====================================================
// Excel 上传
// =====================================================

async function handleExcelUpload() {

    const fileInput =
        document.getElementById(
            "excelFile"
        );


    const uploadBtn =
        document.getElementById(
            "uploadBtn"
        );


    if (
        !fileInput ||
        !fileInput.files ||
        fileInput.files.length === 0
    ) {

        showUploadStatus(
            "请先选择 Excel 文件",
            "error"
        );

        return;

    }


    const file =
        fileInput.files[0];


    try {

        uploadBtn.disabled = true;


        showUploadStatus(
            "正在读取 Excel 数据...",
            "loading"
        );


        const arrayBuffer =
            await file.arrayBuffer();


        const workbook =
            XLSX.read(
                arrayBuffer,
                {
                    type: "array",
                    cellDates: false
                }
            );


        let parsedRows = [];


        for (
            const sheetName of workbook.SheetNames
        ) {

            const worksheet =
                workbook.Sheets[
                    sheetName
                ];


            const rows =
                XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        header: 1,
                        defval: "",
                        raw: true
                    }
                );


            const parsed =
                parseExcelDailyData(
                    rows
                );


            if (
                parsed &&
                parsed.length > 0
            ) {

                parsedRows =
                    parsed;

                break;

            }

        }


        if (
            parsedRows.length === 0
        ) {

            throw new Error(
                "没有在 Excel 中找到有效的每日数据"
            );

        }


        showUploadStatus(
            "Excel 已识别，正在保存数据...",
            "loading"
        );


        let insertCount = 0;

        let updateCount = 0;


        for (
            const item of parsedRows
        ) {

            const result =
                await saveShopData(
                    item
                );


            if (
                result === "insert"
            ) {

                insertCount++;

            }


            if (
                result === "update"
            ) {

                updateCount++;

            }

        }


        await loadShopData();


        const previewItem =
            parsedRows[
                parsedRows.length - 1
            ];


        renderPreview(
            previewItem
        );


        showUploadStatus(
            `上传成功！新增 ${insertCount} 天，更新 ${updateCount} 天。`,
            "success"
        );


    }
    catch (
        error
    ) {

        console.error(
            "Excel 上传失败：",
            error
        );


        showUploadStatus(
            "上传失败：" +
            (
                error.message ||
                "未知错误"
            ),
            "error"
        );

    }
    finally {

        uploadBtn.disabled =
            false;

    }

}


// =====================================================
// Excel 数据解析
// =====================================================

function parseExcelDailyData(
    rows
) {

    // =================================================
    // 第一种：每日数据格式
    // =================================================

    let headerIndex = -1;


    for (
        let i = 0;
        i < rows.length;
        i++
    ) {

        const row =
            rows[i] || [];


        const text =
            row
                .map(
                    cell =>
                        String(
                            cell || ""
                        ).trim()
                )
                .join(" ");


        if (
            text.includes("日期") &&
            (
                text.includes("GMV") ||
                text.includes("订单")
            )
        ) {

            headerIndex =
                i;

            break;

        }

    }


    if (
        headerIndex !== -1
    ) {

        const headerRow =
            rows[
                headerIndex
            ] || [];


        const headerMap = {};


        headerRow.forEach(
            function (
                header,
                index
            ) {

                const key =
                    normalizeHeader(
                        header
                    );


                if (
                    key
                ) {

                    headerMap[key] =
                        index;

                }

            }
        );


        const dataRows =
            rows.slice(
                headerIndex + 1
            );


        const result = [];


        for (
            const row of dataRows
        ) {

            if (
                !row ||
                row.length === 0
            ) {

                continue;

            }


            const rawDate =
                getCellByPossibleHeaders(
                    row,
                    headerMap,
                    [
                        "日期",
                        "date"
                    ]
                );


            const date =
                parseTikTokDate(
                    rawDate
                );


            if (
                !date
            ) {

                continue;

            }


            result.push(
                buildShopDataItem(
                    row,
                    headerMap,
                    date
                )
            );

        }


        result.sort(
            function (
                a,
                b
            ) {

                return compareDates(
                    a.date,
                    b.date
                );

            }
        );


        return result;

    }


    // =================================================
    // 第二种：
    //
    // 分析日期：12/08/2026
    //
    // 数据概览
    // 总计值
    // =================================================

    let analysisDate = null;


    for (
        let i = 0;
        i < Math.min(
            rows.length,
            15
        );
        i++
    ) {

        const row =
            rows[i] || [];


        for (
            const cell of row
        ) {

            if (
                cell === null ||
                cell === undefined ||
                cell === ""
            ) {

                continue;

            }


            const text =
                String(
                    cell
                ).trim();


            if (
                text.includes(
                    "分析日期"
                )
            ) {

                const match =
                    text.match(
                        /分析日期\s*[:：]\s*(.+)/
                    );


                if (
                    match &&
                    match[1]
                ) {

                    let dateText =
                        match[1].trim();


                    dateText =
                        dateText
                            .replace(
                                /\s+/g,
                                ""
                            );


                    if (
                        dateText.includes("-")
                    ) {

                        dateText =
                            dateText.split(
                                "-"
                            )[0];

                    }


                    if (
                        dateText.includes("至")
                    ) {

                        dateText =
                            dateText.split(
                                "至"
                            )[0];

                    }


                    if (
                        dateText.includes("~")
                    ) {

                        dateText =
                            dateText.split(
                                "~"
                            )[0];

                    }


                    analysisDate =
    parseTikTokDate(
        dateText
    );


                    if (
                        analysisDate
                    ) {

                        break;

                    }

                }

            }

        }


        if (
            analysisDate
        ) {

            break;

        }

    }


    if (
        !analysisDate
    ) {

        return [];

    }


    // =================================================
    // 寻找总计值
    // =================================================

    let totalRowIndex = -1;


    for (
        let i = 0;
        i < rows.length;
        i++
    ) {

        const row =
            rows[i] || [];


        const rowText =
            row
                .map(
                    cell =>
                        String(
                            cell || ""
                        ).trim()
                )
                .join(" ");


        if (
            rowText === "总计值"
        ) {

            totalRowIndex =
                i;

            break;

        }

    }


    if (
        totalRowIndex === -1
    ) {

        for (
            let i = 0;
            i < rows.length;
            i++
        ) {

            const row =
                rows[i] || [];


            const rowText =
                row
                    .map(
                        cell =>
                            String(
                                cell || ""
                            ).trim()
                    )
                    .join(" ");


            if (
                rowText.includes(
                    "总计值"
                )
            ) {

                totalRowIndex =
                    i;

                break;

            }

        }

    }


    if (
        totalRowIndex === -1
    ) {

        return [];

    }


    // =================================================
    // 寻找表头
    // =================================================

    let headerRowIndex = -1;


    for (
        let i =
            totalRowIndex - 1;

        i >=
            Math.max(
                0,
                totalRowIndex - 10
            );

        i--
    ) {

        const row =
            rows[i] || [];


        const text =
            row
                .map(
                    cell =>
                        String(
                            cell || ""
                        ).trim()
                )
                .join(" ");


        if (
            text.includes("GMV") ||
            text.includes("订单") ||
            text.includes("客户") ||
            text.includes("曝光")
        ) {

            headerRowIndex =
                i;

            break;

        }

    }


    if (
        headerRowIndex === -1
    ) {

        headerRowIndex =
            Math.max(
                0,
                totalRowIndex - 1
            );

    }


    const headerRow =
        rows[
            headerRowIndex
        ] || [];


    const totalRow =
        rows[
            totalRowIndex
        ] || [];


    const headerMap = {};


    headerRow.forEach(
        function (
            header,
            index
        ) {

            const key =
                normalizeHeader(
                    header
                );


            if (
                key
            ) {

                headerMap[key] =
                    index;

            }

        }
    );


    return [

        buildShopDataItem(
            totalRow,
            headerMap,
            analysisDate
        )

    ];

}


// =====================================================
// 创建标准数据
// =====================================================

function buildShopDataItem(
    row,
    headerMap,
    date
) {

    const gmv =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "GMV",
                "总GMV",
                "商品GMV"
            ]
        );


    const orders =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "订单数",
                "订单",
                "总订单"
            ]
        );


    const customers =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "客户数",
                "客户",
                "买家数"
            ]
        );


    const unitsSold =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "商品成交件数",
                "商品成交数量",
                "成交件数",
                "销量",
                "商品件数"
            ]
        );


    const cancelledReturnedUnits =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "已取消和已退货的商品数",
                "已取消和已退货商品数",
                "取消和退货商品数",
                "取消退货商品数"
            ]
        );


    const refundAmount =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "退款金额",
                "退款",
                "退款总额"
            ]
        );


    const impressions =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "商品曝光次数",
                "商品曝光",
                "曝光",
                "商品曝光量"
            ]
        );


    const uniqueImpressions =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "去重商品曝光次数",
                "去重曝光次数",
                "去重商品曝光"
            ]
        );


    const clicks =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "商品点击量",
                "商品点击",
                "点击",
                "商品点击次数"
            ]
        );


    const uniqueClicks =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "去重点击次数",
                "去重商品点击次数",
                "去重商品点击"
            ]
        );


    const averageOrderAmount =
        getNumberByPossibleHeaders(
            row,
            headerMap,
            [
                "平均订单金额",
                "客单价",
                "平均订单价",
                "平均客单价"
            ]
        );


    const ctr =
        impressions > 0
            ? (
                clicks /
                impressions
            ) * 100
            : 0;


    return {

        date:
            date,

        gmv:
            gmv,

        orders:
            orders,

        customers:
            customers,

        units_sold:
            unitsSold,

        cancelled_returned_units:
            cancelledReturnedUnits,

        refund_amount:
            refundAmount,

        product_impressions:
            impressions,

        unique_product_impressions:
            uniqueImpressions,

        product_clicks:
            clicks,

        unique_product_clicks:
            uniqueClicks,

        average_order_amount:
            averageOrderAmount,

        ctr:
            ctr

    };

}


// =====================================================
// 表头标准化
// =====================================================

function normalizeHeader(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .replace(
            /\s+/g,
            ""
        );

}


// =====================================================
// 获取单元格
// =====================================================

function getCellByPossibleHeaders(
    row,
    headerMap,
    possibleHeaders
) {

    for (
        const header of possibleHeaders
    ) {

        const normalized =
            normalizeHeader(
                header
            );


        if (
            headerMap[
                normalized
            ] !== undefined
        ) {

            return row[
                headerMap[
                    normalized
                ]
            ];

        }

    }


    return "";

}


// =====================================================
// 获取数字
// =====================================================

function getNumberByPossibleHeaders(
    row,
    headerMap,
    possibleHeaders
) {

    const value =
        getCellByPossibleHeaders(
            row,
            headerMap,
            possibleHeaders
        );


    return toNumber(
        value
    );

}


// =====================================================
// Excel 日期
// =====================================================

// =====================================================
// Excel 日期解析
// =====================================================
// TikTok Shop 日期格式：
// DD/MM/YYYY
//
// 例如：
// 12/08/2026
// = 2026年8月12日
//
// 注意：
// XLSX.read 必须使用 cellDates: false
// 这样我们才能拿到 Excel 原始日期值
// =====================================================



// =====================================================
// 创建日期
// =====================================================

function buildDateString(
    year,
    month,
    day
) {

    const date =
        new Date(
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


    return (
        year +
        "-" +
        String(
            month
        ).padStart(
            2,
            "0"
        ) +
        "-" +
        String(
            day
        ).padStart(
            2,
            "0"
        )
    );

}


// =====================================================
// 数字
// =====================================================

function toNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    if (
        typeof value === "number"
    ) {

        return Number.isFinite(
            value
        )
            ? value
            : 0;

    }


    const text =
        String(value)
            .replace(
                /[$,%\s,]/g,
                ""
            )
            .trim();


    const number =
        parseFloat(
            text
        );


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


// =====================================================
// 保存到 Supabase
// =====================================================

async function saveShopData(
    item
) {

    const client =
        getSupabaseClient();


    if (
        !client
    ) {

        throw new Error(
            "Supabase 连接不存在"
        );

    }


    const {
        data: existing,
        error: selectError
    } =
        await client
            .from(
                "shop_daily_metrics"
            )
            .select(
                "id,date"
            )
            .eq(
                "date",
                item.date
            )
            .limit(
                1
            );


    if (
        selectError
    ) {

        throw selectError;

    }


    const payload = {

        date:
            item.date,

        gmv:
            item.gmv,

        orders:
            item.orders,

        customers:
            item.customers,

        units_sold:
            item.units_sold,

        cancelled_returned_units:
            item.cancelled_returned_units,

        refund_amount:
            item.refund_amount,

        product_impressions:
            item.product_impressions,

        unique_product_impressions:
            item.unique_product_impressions,

        product_clicks:
            item.product_clicks,

        unique_product_clicks:
            item.unique_product_clicks,

        average_order_amount:
            item.average_order_amount

    };


    if (
        existing &&
        existing.length > 0
    ) {

        const {
            error
        } =
            await client
                .from(
                    "shop_daily_metrics"
                )
                .update(
                    payload
                )
                .eq(
                    "id",
                    existing[0].id
                );


        if (
            error
        ) {

            throw error;

        }


        return "update";

    }


    const {
        error
    } =
        await client
            .from(
                "shop_daily_metrics"
            )
            .insert(
                payload
            );


    if (
        error
    ) {

        throw error;

    }


    return "insert";

}


// =====================================================
// 读取历史数据
// =====================================================

async function loadShopData() {

    const client =
        getSupabaseClient();


    if (
        !client
    ) {

        showHistoryEmpty(
            "Supabase 连接不存在"
        );

        return;

    }


    showHistoryLoading(
        true
    );


    try {

        const {
            data,
            error
        } =
            await client
                .from(
                    "shop_daily_metrics"
                )
                .select("*")
                .order(
                    "date",
                    {
                        ascending: true
                    }
                );


        if (
            error
        ) {

            throw error;

        }


        allShopData =
            (
                data || []
            ).map(
                normalizeDatabaseRow
            );


        /*
         * 第一次加载：
         * 默认显示全部数据
         */

        filteredShopData =
            [
                ...allShopData
            ];


        renderHistoryTable(
            allShopData
        );


        updateOverview(
            allShopData
        );


        showHistoryLoading(
            false
        );


        /*
         * 数据加载完成以后，
         * 初始化健康度和趋势。
         */

        setTimeout(
            function () {

                renderBusinessHealth();

                renderTrendSection();

            },
            50
        );


    }
    catch (
        error
    ) {

        console.error(
            "读取店铺数据失败：",
            error
        );


        showHistoryLoading(
            false
        );


        showHistoryEmpty(
            "读取数据失败：" +
            error.message
        );

    }

}


// =====================================================
// 数据库数据标准化
// =====================================================

function normalizeDatabaseRow(
    row
) {

    const impressions =
        toNumber(
            row.product_impressions
        );


    const clicks =
        toNumber(
            row.product_clicks
        );


    const ctr =
        impressions > 0
            ? (
                clicks /
                impressions
            ) * 100
            : 0;


    return {

        date:
            String(
                row.date || ""
            ).substring(
                0,
                10
            ),

        gmv:
            toNumber(
                row.gmv
            ),

        orders:
            toNumber(
                row.orders
            ),

        customers:
            toNumber(
                row.customers
            ),

        units_sold:
            toNumber(
                row.units_sold
            ),

        cancelled_returned_units:
            toNumber(
                row.cancelled_returned_units
            ),

        refund_amount:
            toNumber(
                row.refund_amount
            ),

        product_impressions:
            impressions,

        unique_product_impressions:
            toNumber(
                row.unique_product_impressions
            ),

        product_clicks:
            clicks,

        unique_product_clicks:
            toNumber(
                row.unique_product_clicks
            ),

        average_order_amount:
            toNumber(
                row.average_order_amount
            ),

        ctr:
            ctr

    };

}


// =====================================================
// 日期选择器事件
// =====================================================

function bindDatePickerEvents() {

    const button =
        document.getElementById(
            "dateRangeButton"
        );


    const wrapper =
        document.getElementById(
            "dateRangeWrapper"
        );


    if (
        button
    ) {

        button.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();


                const picker =
                    document.getElementById(
                        "datePicker"
                    );


                if (
                    picker.classList.contains(
                        "open"
                    )
                ) {

                    closeDatePicker();

                }
                else {

                    openDatePicker();

                }

            }
        );

    }


    document.addEventListener(
        "click",
        function (event) {

            if (
                wrapper &&
                !wrapper.contains(
                    event.target
                )
            ) {

                closeDatePicker();

            }

        }
    );


    const prevMonth =
        document.getElementById(
            "prevMonth"
        );


    const nextMonth =
        document.getElementById(
            "nextMonth"
        );


    if (
        prevMonth
    ) {

        prevMonth.addEventListener(
            "click",
            function () {

                currentCalendarDate =
                    new Date(
                        currentCalendarDate.getFullYear(),
                        currentCalendarDate.getMonth() - 1,
                        1
                    );


                renderCalendar();

            }
        );

    }


    if (
        nextMonth
    ) {

        nextMonth.addEventListener(
            "click",
            function () {

                currentCalendarDate =
                    new Date(
                        currentCalendarDate.getFullYear(),
                        currentCalendarDate.getMonth() + 1,
                        1
                    );


                renderCalendar();

            }
        );

    }


    document
        .querySelectorAll(
            ".shop-date-shortcut"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        handleShortcut(
                            button.dataset.shortcut
                        );

                    }
                );

            }
        );


    const cancel =
        document.getElementById(
            "dateCancel"
        );


    const confirm =
        document.getElementById(
            "dateConfirm"
        );


    if (
        cancel
    ) {

        cancel.addEventListener(
            "click",
            function () {

                closeDatePicker();

            }
        );

    }


    if (
        confirm
    ) {

        confirm.addEventListener(
            "click",
            function () {

                if (
                    tempStartDate &&
                    tempEndDate
                ) {

                    selectedStartDate =
                        tempStartDate;


                    selectedEndDate =
                        tempEndDate;


                    updateDateRangeText();


                    closeDatePicker();


                    applyDateFilter();

                }
                else {

                    alert(
                        "请选择完整的日期范围"
                    );

                }

            }
        );

    }

}

// =====================================================
// 打开日期选择器
// =====================================================



// =====================================================
// 关闭日期选择器
// =====================================================



// =====================================================
// 渲染日历
//
// 重要：
// hover 时不重新生成 DOM
// =====================================================



// =====================================================
// 更新日期范围预览
// =====================================================



// =====================================================
// 日期范围样式
// =====================================================



// =====================================================
// 点击日期
// =====================================================



// =====================================================
// 快捷日期
// =====================================================



// =====================================================
// 更新日期范围按钮
// =====================================================



// =====================================================
// 更新日期选择器底部
// =====================================================



// =====================================================
// 查询和重置
// =====================================================



// =====================================================
// 日期查询
// =====================================================


// =====================================================
// 打开日期选择器
// =====================================================

function openDatePicker() {

    const picker =
        document.getElementById(
            "datePicker"
        );


    if (!picker) {

        return;

    }


    tempStartDate =
        selectedStartDate;


    tempEndDate =
        selectedEndDate;


    hoverDate = null;


    if (
        selectedStartDate
    ) {

        const date =
            parseLocalDate(
                selectedStartDate
            );


        currentCalendarDate =
            new Date(
                date.getFullYear(),
                date.getMonth(),
                1
            );

    }


    picker.classList.add(
        "open"
    );


    renderCalendar();


    updateSelectedRangeText();

}


// =====================================================
// 关闭日期选择器
// =====================================================

function closeDatePicker() {

    const picker =
        document.getElementById(
            "datePicker"
        );


    if (picker) {

        picker.classList.remove(
            "open"
        );

    }


    hoverDate = null;

}


// =====================================================
// 渲染日历
//
// 重要：
// hover 时不重新生成 DOM
// =====================================================

function renderCalendar() {

    const title =
        document.getElementById(
            "calendarTitle"
        );


    const container =
        document.getElementById(
            "calendarDays"
        );


    if (
        !title ||
        !container
    ) {

        return;

    }


    const year =
        currentCalendarDate.getFullYear();


    const month =
        currentCalendarDate.getMonth();


    title.textContent =
        year +
        "年 " +
        (month + 1) +
        "月";


    container.innerHTML = "";


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    for (
        let i = 0;
        i < 42;
        i++
    ) {

        let day;

        let date;

        let otherMonth = false;


        if (
            i < firstDay
        ) {

            day =
                previousMonthDays -
                firstDay +
                i +
                1;


            date =
                new Date(
                    year,
                    month - 1,
                    day
                );


            otherMonth = true;

        }

        else if (
            i >=
            firstDay +
            daysInMonth
        ) {

            day =
                i -
                firstDay -
                daysInMonth +
                1;


            date =
                new Date(
                    year,
                    month + 1,
                    day
                );


            otherMonth = true;

        }

        else {

            day =
                i -
                firstDay +
                1;


            date =
                new Date(
                    year,
                    month,
                    day
                );

        }


        const dateString =
            formatLocalDate(
                date
            );


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "shop-calendar-day";


        button.textContent =
            day;


        button.dataset.date =
            dateString;


        if (
            otherMonth
        ) {

            button.classList.add(
                "other-month"
            );

        }


        if (
            dateString ===
            formatLocalDate(
                new Date()
            )
        ) {

            button.classList.add(
                "today"
            );

        }


        applyCalendarDateClasses(
            button,
            dateString
        );


        button.addEventListener(
            "mouseenter",
            function () {

                if (
                    tempStartDate &&
                    !tempEndDate
                ) {

                    hoverDate =
                        dateString;


                    updateCalendarRangePreview();

                }

            }
        );


        button.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();


                handleCalendarDateClick(
                    dateString
                );

            }
        );


        container.appendChild(
            button
        );

    }

}


// =====================================================
// 更新日期范围预览
// =====================================================

function updateCalendarRangePreview() {

    const buttons =
        document.querySelectorAll(
            "#calendarDays .shop-calendar-day"
        );


    buttons.forEach(
        function (button) {

            const dateString =
                button.dataset.date;


            button.classList.remove(
                "in-range"
            );


            button.classList.remove(
                "start-date"
            );


            button.classList.remove(
                "end-date"
            );


            applyCalendarDateClasses(
                button,
                dateString
            );

        }
    );

}


// =====================================================
// 日期范围样式
// =====================================================

function applyCalendarDateClasses(
    button,
    dateString
) {

    if (
        tempStartDate &&
        dateString ===
        tempStartDate
    ) {

        button.classList.add(
            "start-date"
        );

    }


    if (
        tempEndDate &&
        dateString ===
        tempEndDate
    ) {

        button.classList.add(
            "end-date"
        );

    }


    let rangeEnd =
        tempEndDate;


    if (
        tempStartDate &&
        !tempEndDate &&
        hoverDate
    ) {

        rangeEnd =
            hoverDate;

    }


    if (
        tempStartDate &&
        rangeEnd
    ) {

        let start =
            tempStartDate;


        let end =
            rangeEnd;


        if (
            compareDates(
                start,
                end
            ) > 0
        ) {

            start =
                rangeEnd;


            end =
                tempStartDate;

        }


        if (
            compareDates(
                dateString,
                start
            ) >= 0 &&
            compareDates(
                dateString,
                end
            ) <= 0
        ) {

            button.classList.add(
                "in-range"
            );

        }

    }

}


// =====================================================
// 点击日期
// =====================================================

function handleCalendarDateClick(
    dateString
) {

    // =================================================
    // 第一次点击
    // =================================================

    if (
        !tempStartDate ||
        tempEndDate
    ) {

        tempStartDate =
            dateString;


        tempEndDate =
            null;


        hoverDate =
            null;


        updateSelectedRangeText();


        updateCalendarRangePreview();


        return;

    }


    // =================================================
    // 第二次点击
    // =================================================

    if (
        tempStartDate &&
        !tempEndDate
    ) {

        if (
            compareDates(
                dateString,
                tempStartDate
            ) < 0
        ) {

            tempEndDate =
                tempStartDate;


            tempStartDate =
                dateString;

        }
        else {

            tempEndDate =
                dateString;

        }


        hoverDate =
            null;


        updateSelectedRangeText();


        updateCalendarRangePreview();

    }

}


// =====================================================
// 快捷日期
// =====================================================

function handleShortcut(
    type
) {

    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    let start;

    let end;


    if (
        type === "today"
    ) {

        start =
            today;

        end =
            today;

    }

    else if (
        type === "yesterday"
    ) {

        start =
            new Date(
                today
            );


        start.setDate(
            start.getDate() - 1
        );


        end =
            new Date(
                start
            );

    }

    else if (
        type === "7days"
    ) {

        end =
            today;


        start =
            new Date(
                today
            );


        start.setDate(
            start.getDate() - 6
        );

    }

    else if (
        type === "30days"
    ) {

        end =
            today;


        start =
            new Date(
                today
            );


        start.setDate(
            start.getDate() - 29
        );

    }

    else if (
        type === "thismonth"
    ) {

        start =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );


        end =
            today;

    }

    else if (
        type === "lastmonth"
    ) {

        start =
            new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                1
            );


        end =
            new Date(
                today.getFullYear(),
                today.getMonth(),
                0
            );

    }

    else {

        return;

    }


    tempStartDate =
        formatLocalDate(
            start
        );


    tempEndDate =
        formatLocalDate(
            end
        );


    hoverDate =
        null;


    currentCalendarDate =
        new Date(
            start.getFullYear(),
            start.getMonth(),
            1
        );


    updateSelectedRangeText();


    renderCalendar();

}


// =====================================================
// 更新日期范围按钮
// =====================================================

function updateDateRangeText() {

    const element =
        document.getElementById(
            "dateRangeText"
        );


    if (!element) {

        return;

    }


    if (
        selectedStartDate &&
        selectedEndDate
    ) {

        element.textContent =
            formatDisplayDate(
                selectedStartDate
            ) +
            " ～ " +
            formatDisplayDate(
                selectedEndDate
            );

    }
    else {

        element.textContent =
            "选择日期范围";

    }

}


// =====================================================
// 更新日期选择器底部
// =====================================================

function updateSelectedRangeText() {

    const element =
        document.getElementById(
            "selectedRangeText"
        );


    if (!element) {

        return;

    }


    if (
        tempStartDate &&
        tempEndDate
    ) {

        element.textContent =
            formatDisplayDate(
                tempStartDate
            ) +
            " ～ " +
            formatDisplayDate(
                tempEndDate
            );

    }

    else if (
        tempStartDate
    ) {

        element.textContent =
            "开始日期：" +
            formatDisplayDate(
                tempStartDate
            ) +
            " · 请选择结束日期";

    }

    else {

        element.textContent =
            "尚未选择日期";

    }

}


// =====================================================
// 查询和重置
// =====================================================

function bindQueryEvents() {

    const queryBtn =
        document.getElementById(
            "queryBtn"
        );


    const resetBtn =
        document.getElementById(
            "resetBtn"
        );


    if (
        queryBtn
    ) {

        queryBtn.addEventListener(
            "click",
            applyDateFilter
        );

    }


    if (
        resetBtn
    ) {

        resetBtn.addEventListener(
            "click",
            function () {

                selectedStartDate =
                    null;


                selectedEndDate =
                    null;


                tempStartDate =
                    null;


                tempEndDate =
                    null;


                hoverDate =
                    null;


                filteredShopData =
                    [
                        ...allShopData
                    ];


                updateDateRangeText();


                updateOverview(
                    allShopData
                );


                renderHistoryTable(
                    allShopData
                );


                const text =
                    document.getElementById(
                        "overviewDateText"
                    );


                if (text) {

                    text.textContent =
                        "当前全部数据";

                }


                renderBusinessHealth();

                renderTrendSection();

            }
        );

    }

}


// =====================================================
// 日期查询
// =====================================================

function applyDateFilter() {

    if (
        !selectedStartDate ||
        !selectedEndDate
    ) {

        alert(
            "请先选择完整日期范围"
        );


        return;

    }


    filteredShopData =
        allShopData.filter(
            function (item) {

                return (
                    compareDates(
                        item.date,
                        selectedStartDate
                    ) >= 0 &&

                    compareDates(
                        item.date,
                        selectedEndDate
                    ) <= 0
                );

            }
        );


    updateOverview(
        filteredShopData
    );


    renderHistoryTable(
        filteredShopData
    );


    const text =
        document.getElementById(
            "overviewDateText"
        );


    if (text) {

        text.textContent =
            formatDisplayDate(
                selectedStartDate
            ) +
            " ～ " +
            formatDisplayDate(
                selectedEndDate
            );

    }


    renderBusinessHealth();

    renderTrendSection();


    if (
        typeof updateComparison ===
        "function"
    ) {

        updateComparison(
            selectedStartDate,
            selectedEndDate
        );

    }

}

// =====================================================
// 经营总览
// =====================================================

function updateOverview(
    data
) {

    let totalGMV = 0;

    let totalOrders = 0;

    let totalUnits = 0;

    let totalCustomers = 0;

    let totalRefund = 0;

    let totalImpressions = 0;

    let totalClicks = 0;


    (
        data || []
    ).forEach(
        function (item) {

            totalGMV +=
                toNumber(
                    item.gmv
                );


            totalOrders +=
                toNumber(
                    item.orders
                );


            totalUnits +=
                toNumber(
                    item.units_sold
                );


            totalCustomers +=
                toNumber(
                    item.customers
                );


            totalRefund +=
                toNumber(
                    item.refund_amount
                );


            totalImpressions +=
                toNumber(
                    item.product_impressions
                );


            totalClicks +=
                toNumber(
                    item.product_clicks
                );

        }
    );


    const totalAOV =
        totalOrders > 0
            ? totalGMV / totalOrders
            : 0;


    const totalCTR =
        totalImpressions > 0
            ? (
                totalClicks /
                totalImpressions
            ) * 100
            : 0;


    setText(
        "totalGMV",
        formatMoney(
            totalGMV
        )
    );


    setText(
        "totalOrders",
        formatNumber(
            totalOrders
        )
    );


    setText(
        "totalUnits",
        formatNumber(
            totalUnits
        )
    );


    setText(
        "totalCustomers",
        formatNumber(
            totalCustomers
        )
    );


    setText(
        "totalAOV",
        formatMoney(
            totalAOV
        )
    );


    setText(
        "totalRefund",
        formatMoney(
            totalRefund
        )
    );


    setText(
        "totalImpressions",
        formatNumber(
            totalImpressions
        )
    );


    setText(
        "totalClicks",
        formatNumber(
            totalClicks
        )
    );


    setText(
        "totalCTR",
        formatPercent(
            totalCTR
        )
    );

}


// =====================================================
// 数据预览
// =====================================================

function renderPreview(
    item
) {

    const section =
        document.getElementById(
            "previewSection"
        );


    if (
        !section ||
        !item
    ) {

        return;

    }


    section.style.display =
        "block";


    setText(
        "previewDate",
        formatDisplayDate(
            item.date
        )
    );


    setText(
        "previewGMV",
        formatMoney(
            item.gmv
        )
    );


    setText(
        "previewOrders",
        formatNumber(
            item.orders
        )
    );


    setText(
        "previewUnits",
        formatNumber(
            item.units_sold
        )
    );


    setText(
        "previewCustomers",
        formatNumber(
            item.customers
        )
    );


    setText(
        "previewImpressions",
        formatNumber(
            item.product_impressions
        )
    );


    setText(
        "previewClicks",
        formatNumber(
            item.product_clicks
        )
    );


    setText(
        "previewCTR",
        formatPercent(
            item.ctr
        )
    );


    setText(
        "previewAOV",
        formatMoney(
            item.average_order_amount
        )
    );

}


// =====================================================
// 每日明细
// =====================================================

function renderHistoryTable(
    data
) {

    const loading =
        document.getElementById(
            "historyLoading"
        );


    const empty =
        document.getElementById(
            "historyEmpty"
        );


    const wrapper =
        document.getElementById(
            "historyTableWrapper"
        );


    const tbody =
        document.getElementById(
            "historyTableBody"
        );


    if (!tbody) {

        return;

    }


    if (loading) {

        loading.style.display =
            "none";

    }


    tbody.innerHTML =
        "";


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "block";


            empty.textContent =
                "暂时还没有店铺数据";

        }


        if (wrapper) {

            wrapper.style.display =
                "none";

        }


        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    if (wrapper) {

        wrapper.style.display =
            "block";

    }


    const sorted =
        [...data].sort(
            function (
                a,
                b
            ) {

                return compareDates(
                    b.date,
                    a.date
                );

            }
        );


    sorted.forEach(
        function (item) {

            const tr =
                document.createElement(
                    "tr"
                );


            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        formatDisplayDate(
                            item.date
                        )
                    )}
                </td>

                <td>
                    ${formatMoney(
                        item.gmv
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.orders
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.units_sold
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.customers
                    )}
                </td>

                <td>
                    ${formatMoney(
                        item.refund_amount
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.product_impressions
                    )}
                </td>

                <td>
                    ${formatNumber(
                        item.product_clicks
                    )}
                </td>

                <td>
                    ${formatPercent(
                        item.ctr
                    )}
                </td>

                <td>
                    ${formatMoney(
                        item.average_order_amount
                    )}
                </td>

            `;


            tbody.appendChild(
                tr
            );

        }
    );

}


// =====================================================
// 上一期数据
// =====================================================

async function updateComparison(
    startDate,
    endDate
) {

    const currentStart =
        parseLocalDate(
            startDate
        );


    const currentEnd =
        parseLocalDate(
            endDate
        );


    const days =
        Math.round(
            (
                currentEnd -
                currentStart
            ) / 86400000
        ) + 1;


    const previousEnd =
        new Date(
            currentStart
        );


    previousEnd.setDate(
        previousEnd.getDate() - 1
    );


    const previousStart =
        new Date(
            previousEnd
        );


    previousStart.setDate(
        previousStart.getDate() -
        days +
        1
    );


    const previousStartString =
        formatLocalDate(
            previousStart
        );


    const previousEndString =
        formatLocalDate(
            previousEnd
        );


    const previousData =
        allShopData.filter(
            function (item) {

                return (
                    compareDates(
                        item.date,
                        previousStartString
                    ) >= 0 &&

                    compareDates(
                        item.date,
                        previousEndString
                    ) <= 0
                );

            }
        );


    renderComparison(
        previousData,
        previousStartString,
        previousEndString
    );

}


// =====================================================
// 环比显示
// =====================================================

function renderComparison(
    previousData,
    previousStart,
    previousEnd
) {

    const section =
        document.getElementById(
            "comparisonSection"
        );


    if (!section) {

        return;

    }


    const dateElement =
        section.querySelector(
            ".comparison-date"
        );


    if (dateElement) {

        dateElement.textContent =
            formatDisplayDate(
                previousStart
            ) +
            " ～ " +
            formatDisplayDate(
                previousEnd
            );

    }


    const empty =
        section.querySelector(
            ".comparison-empty"
        );


    if (
        !previousData ||
        previousData.length === 0
    ) {

        if (empty) {

            empty.textContent =
                "暂无上期数据";


            empty.style.display =
                "block";

        }


        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    const totals =
        calculateTotals(
            previousData
        );


    renderComparisonValue(
        section,
        "gmv",
        formatMoney(
            totals.gmv
        )
    );


    renderComparisonValue(
        section,
        "orders",
        formatNumber(
            totals.orders
        )
    );


    renderComparisonValue(
        section,
        "units",
        formatNumber(
            totals.units
        )
    );


    renderComparisonValue(
        section,
        "customers",
        formatNumber(
            totals.customers
        )
    );


    renderComparisonValue(
        section,
        "refund",
        formatMoney(
            totals.refund
        )
    );


    renderComparisonValue(
        section,
        "impressions",
        formatNumber(
            totals.impressions
        )
    );


    renderComparisonValue(
        section,
        "clicks",
        formatNumber(
            totals.clicks
        )
    );


    renderComparisonValue(
        section,
        "ctr",
        formatPercent(
            totals.ctr
        )
    );


    renderComparisonValue(
        section,
        "aov",
        formatMoney(
            totals.aov
        )
    );

}


// =====================================================
// 环比数值
// =====================================================

function renderComparisonValue(
    section,
    key,
    value
) {

    const element =
        section.querySelector(
            `[data-comparison-key="${key}"]`
        );


    if (!element) {

        return;

    }


    const valueElement =
        element.querySelector(
            ".previous-value"
        );


    if (valueElement) {

        valueElement.textContent =
            value;

    }

}


// =====================================================
// 汇总
// =====================================================

function calculateTotals(
    data
) {

    let gmv = 0;

    let orders = 0;

    let units = 0;

    let customers = 0;

    let refund = 0;

    let impressions = 0;

    let clicks = 0;


    (
        data || []
    ).forEach(
        function (item) {

            gmv +=
                toNumber(
                    item.gmv
                );


            orders +=
                toNumber(
                    item.orders
                );


            units +=
                toNumber(
                    item.units_sold
                );


            customers +=
                toNumber(
                    item.customers
                );


            refund +=
                toNumber(
                    item.refund_amount
                );


            impressions +=
                toNumber(
                    item.product_impressions
                );


            clicks +=
                toNumber(
                    item.product_clicks
                );

        }
    );


    const aov =
        orders > 0
            ? gmv / orders
            : 0;


    const ctr =
        impressions > 0
            ? (
                clicks /
                impressions
            ) * 100
            : 0;


    return {

        gmv,

        orders,

        units,

        customers,

        refund,

        impressions,

        clicks,

        aov,

        ctr

    };

}

// =====================================================
// 趋势卡片
// =====================================================



// =====================================================
// Mini 折线图
// =====================================================



// =====================================================
// 计算最近趋势
// =====================================================



// =====================================================
// 数值同比/环比文字
// =====================================================



// =====================================================
// 日期比较
// =====================================================



// =====================================================
// 本地日期
// =====================================================



// =====================================================
// 日期格式
// =====================================================



// =====================================================
// 日期显示
// =====================================================



// =====================================================
// 金额
// =====================================================



// =====================================================
// 数字
// =====================================================



// =====================================================
// 百分比
// =====================================================

// =====================================================
// 百分比
// =====================================================



// =====================================================
// 设置文字
// =====================================================



// =====================================================
// 上传状态
// =====================================================



// =====================================================
// Loading
// =====================================================


// =====================================================
// 趋势卡片
// =====================================================

function createTrendCard(
    data,
    metric
) {

    const values =
        data.map(
            function (item) {

                if (
                    metric.key ===
                    "ctr"
                ) {

                    return toNumber(
                        item.ctr
                    );

                }


                return toNumber(
                    item[
                        metric.key
                    ]
                );

            }
        );


    const max =
        Math.max(
            ...values,
            0
        );


    const min =
        Math.min(
            ...values,
            0
        );


    const latest =
        values[
            values.length - 1
        ] || 0;


    let previous =
        values[
            values.length - 2
        ] || 0;


    let change = 0;


    if (
        previous !== 0
    ) {

        change =
            (
                (
                    latest -
                    previous
                ) /
                Math.abs(
                    previous
                )
            ) *
            100;

    }


    let changeClass =
        "flat";


    if (
        change > 0
    ) {

        changeClass =
            "up";

    }
    else if (
        change < 0
    ) {

        changeClass =
            "down";

    }


    let changeText;


    if (
        previous === 0
    ) {

        changeText =
            "—";

    }
    else {

        changeText =
            (
                change > 0
                    ? "+"
                    : ""
            ) +
            change.toFixed(
                1
            ) +
            "%";

    }


    let displayValue;


    if (
        metric.type ===
        "money"
    ) {

        displayValue =
            formatMoney(
                latest
            );

    }

    else if (
        metric.type ===
        "percent"
    ) {

        displayValue =
            formatPercent(
                latest
            );

    }

    else {

        displayValue =
            formatNumber(
                latest
            );

    }


    /*
     * 创建简单 SVG 折线图
     */

    const chart =
        createMiniLineChart(
            values
        );


    return `

        <div class="trend-card">

            <div class="trend-card-header">

                <div>

                    <div class="trend-card-title">
                        ${metric.title}
                    </div>

                    <div class="trend-card-value">
                        ${displayValue}
                    </div>

                </div>


                <div class="
                    trend-change
                    ${changeClass}
                ">
                    ${changeText}
                </div>

            </div>


            <div class="trend-chart">

                ${chart}

            </div>


            <div class="trend-footer">

                <span>
                    ${formatDisplayDate(
                        data[0].date
                    )}
                </span>

                <span>
                    ${formatDisplayDate(
                        data[
                            data.length - 1
                        ].date
                    )}
                </span>

            </div>

        </div>

    `;

}


// =====================================================
// Mini 折线图
// =====================================================

function createMiniLineChart(
    values
) {

    if (
        !values ||
        values.length === 0
    ) {

        return "";

    }


    const width =
        500;


    const height =
        150;


    const padding =
        12;


    const min =
        Math.min(
            ...values
        );


    const max =
        Math.max(
            ...values
        );


    const range =
        max - min || 1;


    const points =
        values.map(
            function (
                value,
                index
            ) {

                const x =
                    values.length === 1
                        ? width / 2
                        : padding +
                          (
                              index /
                              (
                                  values.length -
                                  1
                              )
                          ) *
                          (
                              width -
                              padding * 2
                          );


                const y =
                    height -
                    padding -
                    (
                        (
                            value -
                            min
                        ) /
                        range
                    ) *
                    (
                        height -
                        padding * 2
                    );


                return (
                    x.toFixed(2) +
                    "," +
                    y.toFixed(2)
                );

            }
        )
        .join(" ");


    return `

        <svg
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="none"
            class="mini-chart-svg"
        >

            <polyline
                points="${points}"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></polyline>

        </svg>

    `;

}


// =====================================================
// 计算最近趋势
// =====================================================

function calculateTrend(
    data,
    key
) {

    if (
        !data ||
        data.length < 2
    ) {

        return {

            change: 0,

            direction: "flat"

        };

    }


    const sorted =
        [...data].sort(
            function (
                a,
                b
            ) {

                return compareDates(
                    a.date,
                    b.date
                );

            }
        );


    const latest =
        toNumber(
            sorted[
                sorted.length - 1
            ][key]
        );


    const previous =
        toNumber(
            sorted[
                sorted.length - 2
            ][key]
        );


    if (
        previous === 0
    ) {

        return {

            change: 0,

            direction: "flat"

        };

    }


    const change =
        (
            (
                latest -
                previous
            ) /
            Math.abs(
                previous
            )
        ) *
        100;


    return {

        change,

        direction:
            change > 0
                ? "up"
                : change < 0
                    ? "down"
                    : "flat"

    };

}


// =====================================================
// 数值同比/环比文字
// =====================================================

function formatChange(
    current,
    previous
) {

    current =
        toNumber(
            current
        );


    previous =
        toNumber(
            previous
        );


    if (
        previous === 0
    ) {

        return "—";

    }


    const change =
        (
            (
                current -
                previous
            ) /
            Math.abs(
                previous
            )
        ) *
        100;


    if (
        change > 0
    ) {

        return (
            "+" +
            change.toFixed(
                1
            ) +
            "%"
        );

    }


    if (
        change < 0
    ) {

        return (
            change.toFixed(
                1
            ) +
            "%"
        );

    }


    return "0.0%";

}


// =====================================================
// 日期比较
// =====================================================

function compareDates(
    dateA,
    dateB
) {

    const a =
        parseLocalDate(
            dateA
        );


    const b =
        parseLocalDate(
            dateB
        );


    return (
        a.getTime() -
        b.getTime()
    );

}


// =====================================================
// 本地日期
// =====================================================

function parseLocalDate(
    dateString
) {

    if (
        !dateString
    ) {

        return new Date(
            NaN
        );

    }


    const parts =
        String(
            dateString
        )
        .substring(
            0,
            10
        )
        .split(
            "-"
        );


    return new Date(
        Number(
            parts[0]
        ),
        Number(
            parts[1]
        ) - 1,
        Number(
            parts[2]
        )
    );

}


// =====================================================
// 日期格式
// =====================================================

function formatLocalDate(
    date
) {

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ) +
        "-" +
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )
    );

}


// =====================================================
// 日期显示
// =====================================================

function formatDisplayDate(
    dateString
) {

    if (
        !dateString
    ) {

        return "-";

    }


    const date =
        parseLocalDate(
            dateString
        );


    return (
        date.getFullYear() +
        "/" +
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ) +
        "/" +
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )
    );

}


// =====================================================
// 金额
// =====================================================

function formatMoney(
    value
) {

    return (
        "$" +
        toNumber(
            value
        ).toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );

}


// =====================================================
// 数字
// =====================================================

function formatNumber(
    value
) {

    return toNumber(
        value
    ).toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 0
        }
    );

}


// =====================================================
// 百分比
// =====================================================



// =====================================================
// 设置文字
// =====================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (
        element
    ) {

        element.textContent =
            value;

    }

}


// =====================================================
// 上传状态
// =====================================================

function showUploadStatus(
    message,
    type
) {

    const element =
        document.getElementById(
            "uploadStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.className =
        "shop-upload-status " +
        type;

}


// =====================================================
// Loading
// =====================================================

function showHistoryLoading(
    show
) {

    const element =
        document.getElementById(
            "historyLoading"
        );


    if (element) {

        element.style.display =
            show
                ? "block"
                : "none";

    }

}
// =====================================================
// HTML 安全处理
// 防止表格渲染时 escapeHtml 未定义
// =====================================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
// =====================================================
// 店铺经营健康度
// 最终稳定版
// =====================================================

function renderBusinessHealth() {

    const container =
        document.getElementById(
            "businessHealth"
        );


    // 页面没有健康度区域
    // 就直接结束，不影响其他功能
    if (!container) {

        console.log(
            "businessHealth 容器不存在"
        );

        return;

    }


    // =================================================
    // 获取当前数据
    // =================================================

    let data = [];


    if (
        typeof filteredShopData !== "undefined" &&
        Array.isArray(filteredShopData) &&
        filteredShopData.length > 0
    ) {

        data =
            filteredShopData;

    }
    else if (
        typeof allShopData !== "undefined" &&
        Array.isArray(allShopData)
    ) {

        data =
            allShopData;

    }


    // =================================================
    // 没有数据
    // =================================================

    if (
        !data ||
        data.length === 0
    ) {

        container.innerHTML = `

            <div class="health-empty">

                暂无数据

            </div>

        `;

        return;

    }


    // =================================================
    // 汇总数据
    // =================================================

    let totalGMV = 0;

    let totalOrders = 0;

    let totalUnits = 0;

    let totalCustomers = 0;

    let totalRefund = 0;

    let totalImpressions = 0;

    let totalClicks = 0;


    data.forEach(
        function (item) {

            totalGMV +=
                Number(
                    item.gmv
                ) || 0;


            totalOrders +=
                Number(
                    item.orders
                ) || 0;


            totalUnits +=
                Number(
                    item.units_sold
                ) || 0;


            totalCustomers +=
                Number(
                    item.customers
                ) || 0;


            totalRefund +=
                Number(
                    item.refund_amount
                ) || 0;


            totalImpressions +=
                Number(
                    item.product_impressions
                ) || 0;


            totalClicks +=
                Number(
                    item.product_clicks
                ) || 0;

        }
    );


    // =================================================
    // 核心指标
    // =================================================

    const ctr =
        totalImpressions > 0
            ? (
                totalClicks /
                totalImpressions
            ) * 100
            : 0;


    const aov =
        totalOrders > 0
            ? totalGMV /
              totalOrders
            : 0;


    const refundRate =
        totalGMV > 0
            ? (
                totalRefund /
                totalGMV
            ) * 100
            : 0;


    // =================================================
    // 健康度评分
    // =================================================

    let score = 100;


    // -------------------------------------------------
    // CTR
    // -------------------------------------------------

    if (
        totalImpressions > 0
    ) {

        if (
            ctr < 1
        ) {

            score -= 25;

        }
        else if (
            ctr < 2
        ) {

            score -= 15;

        }
        else if (
            ctr < 3
        ) {

            score -= 5;

        }

    }


    // -------------------------------------------------
    // 退款率
    // -------------------------------------------------

    if (
        refundRate > 12
    ) {

        score -= 30;

    }
    else if (
        refundRate > 8
    ) {

        score -= 20;

    }
    else if (
        refundRate > 5
    ) {

        score -= 10;

    }


    // -------------------------------------------------
    // 订单
    // -------------------------------------------------

    if (
        totalOrders === 0
    ) {

        score -= 30;

    }
    else if (
        totalOrders < 5
    ) {

        score -= 10;

    }


    // -------------------------------------------------
    // 限制范围
    // -------------------------------------------------

    score =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    score
                )
            )
        );


    // =================================================
    // 健康度等级
    // =================================================

    let level =
        "一般";

    let levelClass =
        "normal";

    let advice =
        "店铺整体运行正常，建议继续观察数据变化。";


    if (
        score >= 85
    ) {

        level =
            "优秀";

        levelClass =
            "excellent";

        advice =
            "当前店铺经营状态良好，可以继续放大表现优秀的商品和流量。";

    }
    else if (
        score >= 70
    ) {

        level =
            "良好";

        levelClass =
            "good";

        advice =
            "店铺整体表现稳定，可以继续优化流量和转化效率。";

    }
    else if (
        score >= 55
    ) {

        level =
            "一般";

        levelClass =
            "normal";

        advice =
            "部分经营指标存在压力，建议重点检查流量、点击率和转化。";

    }
    else {

        level =
            "需要关注";

        levelClass =
            "danger";

        advice =
            "店铺目前存在明显经营压力，建议重点排查流量、转化和退款问题。";

    }


    // =================================================
    // CTR 状态
    // =================================================

    let ctrScore = 100;


    if (
        totalImpressions > 0
    ) {

        if (
            ctr < 1
        ) {

            ctrScore = 35;

        }
        else if (
            ctr < 2
        ) {

            ctrScore = 55;

        }
        else if (
            ctr < 3
        ) {

            ctrScore = 75;

        }
        else {

            ctrScore = 100;

        }

    }


    // =================================================
    // 退款状态
    // =================================================

    let refundScore = 100;


    if (
        refundRate > 12
    ) {

        refundScore = 30;

    }
    else if (
        refundRate > 8
    ) {

        refundScore = 50;

    }
    else if (
        refundRate > 5
    ) {

        refundScore = 70;

    }


    // =================================================
    // 订单状态
    // =================================================

    let orderScore = 100;


    if (
        totalOrders === 0
    ) {

        orderScore = 30;

    }
    else if (
        totalOrders < 5
    ) {

        orderScore = 60;

    }


    // =================================================
    // 转化状态
    // =================================================

    const conversionRate =
        totalImpressions > 0
            ? (
                totalOrders /
                totalImpressions
            ) * 100
            : 0;


    let conversionScore = 100;


    if (
        totalImpressions > 0
    ) {

        if (
            conversionRate < 0.1
        ) {

            conversionScore = 35;

        }
        else if (
            conversionRate < 0.3
        ) {

            conversionScore = 55;

        }
        else if (
            conversionRate < 0.5
        ) {

            conversionScore = 75;

        }

    }


    // =================================================
    // 输出 HTML
    // =================================================

    container.innerHTML = `

        <div class="health-main">

            <div class="health-score-box">

                <div class="health-score">

                    ${score}

                </div>

                <div class="health-score-label">

                    / 100

                </div>

            </div>


            <div class="health-info">

                <div class="health-title">

                    经营健康度

                </div>


                <div
                    class="health-level ${levelClass}"
                >

                    ${level}

                </div>


                <div class="health-advice">

                    ${advice}

                </div>

            </div>

        </div>


        <div class="health-metrics">


            <div class="health-metric">

                <div class="health-metric-top">

                    <span>
                        点击率
                    </span>

                    <strong>
                        ${ctr.toFixed(2)}%
                    </strong>

                </div>


                <div class="health-progress">

                    <div
                        class="health-progress-bar"
                        style="width:${ctrScore}%"
                    ></div>

                </div>


                <div class="health-metric-subtitle">

                    商品点击 ÷ 商品曝光

                </div>

            </div>



            <div class="health-metric">

                <div class="health-metric-top">

                    <span>
                        退款表现
                    </span>

                    <strong>
                        ${refundRate.toFixed(2)}%
                    </strong>

                </div>


                <div class="health-progress">

                    <div
                        class="health-progress-bar"
                        style="width:${refundScore}%"
                    ></div>

                </div>


                <div class="health-metric-subtitle">

                    退款金额 ÷ GMV

                </div>

            </div>



            <div class="health-metric">

                <div class="health-metric-top">

                    <span>
                        订单表现
                    </span>

                    <strong>
                        ${totalOrders.toLocaleString()}
                    </strong>

                </div>


                <div class="health-progress">

                    <div
                        class="health-progress-bar"
                        style="width:${orderScore}%"
                    ></div>

                </div>


                <div class="health-metric-subtitle">

                    当前日期范围订单

                </div>

            </div>



            <div class="health-metric">

                <div class="health-metric-top">

                    <span>
                        转化效率
                    </span>

                    <strong>
                        ${conversionRate.toFixed(2)}%
                    </strong>

                </div>


                <div class="health-progress">

                    <div
                        class="health-progress-bar"
                        style="width:${conversionScore}%"
                    ></div>

                </div>


                <div class="health-metric-subtitle">

                    订单 ÷ 商品曝光

                </div>

            </div>


        </div>


        <div class="health-summary">

            <div>

                <span>
                    GMV
                </span>

                <strong>
                    $${totalGMV.toLocaleString(
                        "en-US",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    )}
                </strong>

            </div>


            <div>

                <span>
                    客单价
                </span>

                <strong>
                    $${aov.toLocaleString(
                        "en-US",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    )}
                </strong>

            </div>


            <div>

                <span>
                    成交件数
                </span>

                <strong>
                    ${totalUnits.toLocaleString()}
                </strong>

            </div>


            <div>

                <span>
                    客户数
                </span>

                <strong>
                    ${totalCustomers.toLocaleString()}
                </strong>

            </div>

        </div>

    `;


    console.log(
        "经营健康度已更新：",
        score
    );

}


// =====================================================
// 趋势卡片
// =====================================================

function createStableTrendCard(
    data,
    metric
) {

    const values =
        data.map(
            function (
                item
            ) {

                if (
                    metric.key ===
                    "ctr"
                ) {

                    const impressions =
                        Number(
                            item.product_impressions
                        ) || 0;


                    const clicks =
                        Number(
                            item.product_clicks
                        ) || 0;


                    return impressions > 0
                        ? (
                            clicks /
                            impressions
                        ) * 100
                        : 0;

                }


                return Number(
                    item[
                        metric.key
                    ]
                ) || 0;

            }
        );


    const latest =
        values[
            values.length - 1
        ] || 0;


    const previous =
        values.length > 1
            ? values[
                values.length - 2
            ]
            : 0;


    // =================================================
    // 环比变化
    // =================================================

    let change = 0;


    if (
        previous !== 0
    ) {

        change =
            (
                (
                    latest -
                    previous
                ) /
                Math.abs(
                    previous
                )
            ) * 100;

    }


    let changeClass =
        "flat";


    if (
        change > 0
    ) {

        changeClass =
            "up";

    }
    else if (
        change < 0
    ) {

        changeClass =
            "down";

    }


    let changeText =
        "—";


    if (
        previous !== 0
    ) {

        changeText =
            (
                change > 0
                    ? "+"
                    : ""
            ) +
            change.toFixed(
                1
            ) +
            "%";

    }


    // =================================================
    // 最新值
    // =================================================

    let displayValue =
        "";


    if (
        metric.type ===
        "money"
    ) {

        displayValue =
            "$" +
            latest.toLocaleString(
                "en-US",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

    }

    else if (
        metric.type ===
        "percent"
    ) {

        displayValue =
            latest.toFixed(
                2
            ) +
            "%";

    }

    else {

        displayValue =
            latest.toLocaleString(
                "en-US"
            );

    }


    // =================================================
    // SVG 趋势线
    // =================================================

    const svg =
        createStableTrendSVG(
            values
        );


    const firstDate =
        data.length > 0
            ? formatTrendDate(
                data[0].date
            )
            : "";


    const lastDate =
        data.length > 0
            ? formatTrendDate(
                data[
                    data.length - 1
                ].date
            )
            : "";


    return `

        <div class="trend-card">

            <div class="trend-card-header">

                <div>

                    <div class="trend-card-title">

                        ${metric.title}

                    </div>


                    <div class="trend-card-value">

                        ${displayValue}

                    </div>

                </div>


                <div
                    class="
                        trend-change
                        ${changeClass}
                    "
                >

                    ${changeText}

                </div>

            </div>


            <div class="trend-chart">

                ${svg}

            </div>


            <div class="trend-footer">

                <span>

                    ${firstDate}

                </span>


                <span>

                    ${lastDate}

                </span>

            </div>

        </div>

    `;

}


// =====================================================
// 创建稳定版 SVG 趋势线
//
// 不使用动画
// 不使用 Chart.js
// 不会出现切换日期时疯狂播放动画
// =====================================================

function createStableTrendSVG(
    values
) {

    if (
        !values ||
        values.length === 0
    ) {

        return "";

    }


    const width =
        500;


    const height =
        150;


    const padding =
        15;


    // =================================================
    // 只有一个数据点
    // =================================================

    if (
        values.length === 1
    ) {

        return `

            <svg
                viewBox="
                    0
                    0
                    ${width}
                    ${height}
                "
                class="mini-chart-svg"
                preserveAspectRatio="none"
            >

                <circle
                    cx="${width / 2}"
                    cy="${height / 2}"
                    r="5"
                    fill="currentColor"
                ></circle>

            </svg>

        `;

    }


    const min =
        Math.min(
            ...values
        );


    const max =
        Math.max(
            ...values
        );


    let range =
        max -
        min;


    if (
        range === 0
    ) {

        range = 1;

    }


    const points =
        values.map(
            function (
                value,
                index
            ) {

                const x =
                    padding +
                    (
                        index /
                        (
                            values.length -
                            1
                        )
                    ) *
                    (
                        width -
                        padding * 2
                    );


                const y =
                    height -
                    padding -
                    (
                        (
                            value -
                            min
                        ) /
                        range
                    ) *
                    (
                        height -
                        padding * 2
                    );


                return (
                    x.toFixed(2) +
                    "," +
                    y.toFixed(2)
                );

            }
        )
        .join(" ");


    return `

        <svg
            viewBox="
                0
                0
                ${width}
                ${height}
            "
            class="mini-chart-svg"
            preserveAspectRatio="none"
        >

            <polyline
                points="${points}"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></polyline>

        </svg>

    `;

}


// =====================================================
// 趋势日期
// =====================================================


// =====================================================
// 趋势分析
// 适配现有 4 个 Canvas：
// salesChart
// trafficChart
// conversionChart
// afterSaleChart
// =====================================================

let salesChartInstance = null;
let trafficChartInstance = null;
let conversionChartInstance = null;
let afterSaleChartInstance = null;


// =====================================================
// 主趋势渲染
// =====================================================



// =====================================================
// 销售趋势
// =====================================================

function renderSalesTrend(
    data
) {

    const canvas =
        document.getElementById(
            "salesChart"
        );


    const empty =
        document.getElementById(
            "salesChartEmpty"
        );


    if (
        !canvas
    ) {

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "flex";

        }

        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    const activeButton =
        document.querySelector(
            '.shop-chart-tab[data-chart-group="sales"].active'
        );


    const key =
        activeButton
            ? activeButton.dataset.chartKey
            : "gmv";


    const result =
        buildTrendData(
            data,
            key
        );


    drawSimpleCanvasChart(
        canvas,
        result.labels,
        result.values,
        result.tooltipValues,
        key
    );

}


// =====================================================
// 流量趋势
// =====================================================

function renderTrafficTrend(
    data
) {

    const canvas =
        document.getElementById(
            "trafficChart"
        );


    const empty =
        document.getElementById(
            "trafficChartEmpty"
        );


    if (
        !canvas
    ) {

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "flex";

        }

        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    const activeButton =
        document.querySelector(
            '.shop-chart-tab[data-chart-group="traffic"].active'
        );


    const key =
        activeButton
            ? activeButton.dataset.chartKey
            : "impressions";


    const result =
        buildTrendData(
            data,
            key
        );


    drawSimpleCanvasChart(
        canvas,
        result.labels,
        result.values,
        result.tooltipValues,
        key
    );

}


// =====================================================
// 转化趋势
// =====================================================

function renderConversionTrend(
    data
) {

    const canvas =
        document.getElementById(
            "conversionChart"
        );


    const empty =
        document.getElementById(
            "conversionChartEmpty"
        );


    if (
        !canvas
    ) {

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "flex";

        }

        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    const activeButton =
        document.querySelector(
            '.shop-chart-tab[data-chart-group="conversion"].active'
        );


    const key =
        activeButton
            ? activeButton.dataset.chartKey
            : "orderConversion";


    const result =
        buildTrendData(
            data,
            key
        );


    drawSimpleCanvasChart(
        canvas,
        result.labels,
        result.values,
        result.tooltipValues,
        key
    );

}


// =====================================================
// 售后趋势
// =====================================================

function renderAfterSaleTrend(
    data
) {

    const canvas =
        document.getElementById(
            "afterSaleChart"
        );


    const empty =
        document.getElementById(
            "afterSaleChartEmpty"
        );


    if (
        !canvas
    ) {

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "flex";

        }

        return;

    }


    if (empty) {

        empty.style.display =
            "none";

    }


    const activeButton =
        document.querySelector(
            '.shop-chart-tab[data-chart-group="afterSale"].active'
        );


    const key =
        activeButton
            ? activeButton.dataset.chartKey
            : "refund";


    const result =
        buildTrendData(
            data,
            key
        );


    drawSimpleCanvasChart(
        canvas,
        result.labels,
        result.values,
        result.tooltipValues,
        key
    );

}


// =====================================================
// 构造趋势数据
// =====================================================

function buildTrendData(
    data,
    key
) {

    const labels = [];

    const values = [];

    const tooltipValues = [];


    data.forEach(
        function (
            item
        ) {

            labels.push(
                formatTrendDate(
                    item.date
                )
            );


            let value = 0;

            let tooltipValue = 0;


            // =================================================
            // 销售
            // =================================================

            if (
                key === "gmv"
            ) {

                value =
                    Number(
                        item.gmv
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "orders"
            ) {

                value =
                    Number(
                        item.orders
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "units"
            ) {

                value =
                    Number(
                        item.units_sold
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "customers"
            ) {

                value =
                    Number(
                        item.customers
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "aov"
            ) {

                value =
                    Number(
                        item.orders
                    ) > 0
                        ? (
                            Number(
                                item.gmv
                            ) || 0
                        ) /
                        Number(
                            item.orders
                        )
                        : 0;

                tooltipValue =
                    value;

            }


            // =================================================
            // 流量
            // =================================================

            else if (
                key === "impressions"
            ) {

                value =
                    Number(
                        item.product_impressions
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "clicks"
            ) {

                value =
                    Number(
                        item.product_clicks
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "ctr"
            ) {

                const impressions =
                    Number(
                        item.product_impressions
                    ) || 0;


                const clicks =
                    Number(
                        item.product_clicks
                    ) || 0;


                value =
                    impressions > 0
                        ? (
                            clicks /
                            impressions
                        ) * 100
                        : 0;

                tooltipValue =
                    value;

            }


            // =================================================
            // 转化
            // =================================================

            else if (
                key === "orderConversion"
            ) {

                const impressions =
                    Number(
                        item.product_impressions
                    ) || 0;


                const orders =
                    Number(
                        item.orders
                    ) || 0;


                value =
                    impressions > 0
                        ? (
                            orders /
                            impressions
                        ) * 100
                        : 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "productConversion"
            ) {

                const clicks =
                    Number(
                        item.product_clicks
                    ) || 0;


                const units =
                    Number(
                        item.units_sold
                    ) || 0;


                value =
                    clicks > 0
                        ? (
                            units /
                            clicks
                        ) * 100
                        : 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "gmvPerThousand"
            ) {

                const impressions =
                    Number(
                        item.product_impressions
                    ) || 0;


                const gmv =
                    Number(
                        item.gmv
                    ) || 0;


                value =
                    impressions > 0
                        ? (
                            gmv /
                            impressions
                        ) *
                        1000
                        : 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "gmvPerClick"
            ) {

                const clicks =
                    Number(
                        item.product_clicks
                    ) || 0;


                const gmv =
                    Number(
                        item.gmv
                    ) || 0;


                value =
                    clicks > 0
                        ? gmv /
                          clicks
                        : 0;

                tooltipValue =
                    value;

            }


            // =================================================
            // 售后
            // =================================================

            else if (
                key === "refund"
            ) {

                value =
                    Number(
                        item.refund_amount
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "refundRate"
            ) {

                const gmv =
                    Number(
                        item.gmv
                    ) || 0;


                const refund =
                    Number(
                        item.refund_amount
                    ) || 0;


                value =
                    gmv > 0
                        ? (
                            refund /
                            gmv
                        ) * 100
                        : 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "cancelledReturned"
            ) {

                value =
                    Number(
                        item.cancelled_returned_units
                    ) || 0;

                tooltipValue =
                    value;

            }

            else if (
                key === "cancelledReturnedRate"
            ) {

                const units =
                    Number(
                        item.units_sold
                    ) || 0;


                const cancelled =
                    Number(
                        item.cancelled_returned_units
                    ) || 0;


                value =
                    units > 0
                        ? (
                            cancelled /
                            units
                        ) * 100
                        : 0;

                tooltipValue =
                    value;

            }


            values.push(
                value
            );


            tooltipValues.push(
                tooltipValue
            );

        }
    );


    return {

        labels,

        values,

        tooltipValues

    };

}


// =====================================================
// Canvas 趋势图
// 无动画
// =====================================================



// =====================================================
// Canvas 鼠标提示
// =====================================================



// =====================================================
// 趋势按钮
// =====================================================



// =====================================================
// 趋势空状态
// =====================================================

function showTrendEmpty() {

    const ids = [

        "salesChartEmpty",

        "trafficChartEmpty",

        "conversionChartEmpty",

        "afterSaleChartEmpty"

    ];


    ids.forEach(
        function (
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (
                element
            ) {

                element.style.display =
                    "flex";

            }

        }
    );

}


// =====================================================
// 趋势日期
// =====================================================

function formatTrendDate(
    date
) {

    if (
        !date
    ) {

        return "-";

    }


    const parts =
        String(
            date
        )
        .substring(
            0,
            10
        )
        .split(
            "-"
        );


    if (
        parts.length !== 3
    ) {

        return String(
            date
        );

    }


    return (
        Number(
            parts[1]
        ) +
        "/" +
        Number(
            parts[2]
        )
    );

}


// =====================================================
// Y轴数值
// =====================================================

function formatChartAxisValue(
    value
) {

    value =
        Number(
            value
        ) || 0;


    if (
        Math.abs(value) >= 1000000
    ) {

        return (
            (
                value /
                1000000
            ).toFixed(1) +
            "M"
        );

    }


    if (
        Math.abs(value) >= 1000
    ) {

        return (
            (
                value /
                1000
            ).toFixed(1) +
            "K"
        );

    }


    if (
        Math.abs(value) >= 10
    ) {

        return Math.round(
            value
        ).toString();

    }


    return value.toFixed(
        1
    );

}


// =====================================================
// Tooltip 数值
// =====================================================

function formatChartTooltipValue(
    value,
    key
) {

    value =
        Number(
            value
        ) || 0;


    // =========================
    // 金额
    // =========================

    if (
        key === "gmv" ||
        key === "aov" ||
        key === "refund"
    ) {

        return (
            "$" +
            value.toLocaleString(
                "en-US",
                {
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            )
        );

    }


    // =========================
    // 百分比
    // =========================

    if (
        key === "ctr" ||
        key === "orderConversion" ||
        key === "productConversion" ||
        key === "refundRate" ||
        key === "cancelledReturnedRate"
    ) {

        return (
            Math.round(
                value
            ) +
            "%"
        );

    }


    // =========================
    // 数量
    // =========================

    if (
        key === "orders"
    ) {

        return (
            value.toLocaleString(
                "en-US",
                {
                    maximumFractionDigits:0
                }
            )
            +
            " 单"
        );

    }


    if (
        key === "units"
    ) {

        return (
            value.toLocaleString(
                "en-US",
                {
                    maximumFractionDigits:0
                }
            )
            +
            " 件"
        );

    }


    if (
        key === "customers"
    ) {

        return (
            value.toLocaleString(
                "en-US",
                {
                    maximumFractionDigits:0
                }
            )
            +
            " 人"
        );

    }


    if (
        key === "impressions" ||
        key === "clicks"
    ) {

        return (
            value.toLocaleString(
                "en-US",
                {
                    maximumFractionDigits:0
                }
            )
            +
            " 次"
        );

    }


    // 默认

    return value.toLocaleString(
        "en-US",
        {
            maximumFractionDigits:0
        }
    );

}

// =====================================================
// Ian OS
// 趋势图最终修复覆盖层
//
// 解决：
// 1. 鼠标悬停没有数据显示
// 2. Tooltip 被 overflow:hidden 截掉
// 3. 重复趋势分析
// 4. 旧版趋势卡片和新版 Canvas 冲突
// 5. 切换指标时重新绘制
// 6. 不使用动画
// =====================================================


// =====================================================
// 清理重复趋势区域
// =====================================================

function cleanupDuplicateTrendSections() {

    const sections =
        Array.from(
            document.querySelectorAll(
                ".shop-trend-section"
            )
        );


    // -------------------------------------------------
    // 正常情况下只应该有一个
    // -------------------------------------------------

    if (
        sections.length > 1
    ) {

        sections
            .slice(1)
            .forEach(
                function (
                    section
                ) {

                    section.remove();

                }
            );

    }


    // -------------------------------------------------
    // 清理主趋势区域外的旧趋势卡片
    // -------------------------------------------------

    const mainSection =
        document.querySelector(
            ".shop-trend-section"
        );


    if (
        !mainSection
    ) {

        return;

    }


    document
        .querySelectorAll(
            ".trend-card"
        )
        .forEach(
            function (
                card
            ) {

                if (
                    !mainSection.contains(
                        card
                    )
                ) {

                    card.remove();

                }

            }
        );


    // -------------------------------------------------
    // 清理旧版 mini chart 容器
    // 但不动正式 Canvas 趋势图
    // -------------------------------------------------

    document
        .querySelectorAll(
            ".mini-chart-svg"
        )
        .forEach(
            function (
                svg
            ) {

                const parent =
                    svg.closest(
                        ".trend-card"
                    );


                if (
                    parent &&
                    !mainSection.contains(
                        parent
                    )
                ) {

                    parent.remove();

                }

            }
        );

}


// =====================================================
// Tooltip 最终版
// 使用 fixed
// 不受 Canvas 父元素 overflow 影响
// =====================================================

function setupCanvasTooltip(
    canvas,
    points
) {

    if (
        !canvas
    ) {

        return;

    }


    canvas._trendTooltipPoints =
        points;


    // -------------------------------------------------
    // 找到全局 Tooltip
    // -------------------------------------------------

    let tooltip =
        document.getElementById(
            "globalTrendTooltip"
        );


    // -------------------------------------------------
    // 没有就创建
    // -------------------------------------------------

    if (
        !tooltip
    ) {

        tooltip =
            document.createElement(
                "div"
            );


        tooltip.id =
            "globalTrendTooltip";


        tooltip.style.position =
            "fixed";


        tooltip.style.zIndex =
            "999999";


        tooltip.style.pointerEvents =
            "none";


        tooltip.style.display =
            "none";


        tooltip.style.background =
            "#111111";


        tooltip.style.color =
            "#ffffff";


        tooltip.style.padding =
            "10px 13px";


        tooltip.style.borderRadius =
            "10px";


        tooltip.style.fontSize =
            "12px";


        tooltip.style.lineHeight =
            "1.5";


        tooltip.style.boxShadow =
            "0 8px 24px rgba(0,0,0,.16)";


        tooltip.style.whiteSpace =
            "nowrap";


        tooltip.style.transform =
            "translate(10px,-50%)";


        document.body.appendChild(
            tooltip
        );

    }


    // -------------------------------------------------
    // 防止重复绑定
    // -------------------------------------------------

    if (
        canvas._finalTooltipBound
    ) {

        return;

    }


    canvas._finalTooltipBound =
        true;


    // =================================================
    // 鼠标移动
    // =================================================

    canvas.addEventListener(
        "mousemove",
        function (
            event
        ) {

            const rect =
                canvas.getBoundingClientRect();


            const mouseX =
                event.clientX -
                rect.left;


            const mouseY =
                event.clientY -
                rect.top;


            const currentPoints =
                canvas._trendTooltipPoints ||
                [];


            if (
                currentPoints.length === 0
            ) {

                tooltip.style.display =
                    "none";

                return;

            }


            // -------------------------------------------------
            // 找距离鼠标最近的数据点
            // -------------------------------------------------

            let nearest =
                null;


            let nearestDistance =
                Infinity;


            currentPoints.forEach(
                function (
                    point
                ) {

                    const distance =
                        Math.abs(
                            point.x -
                            mouseX
                        );


                    if (
                        distance <
                        nearestDistance
                    ) {

                        nearestDistance =
                            distance;


                        nearest =
                            point;

                    }

                }
            );


            // -------------------------------------------------
            // 鼠标距离数据点太远
            // -------------------------------------------------

            if (
                !nearest ||
                nearestDistance > 70
            ) {

                tooltip.style.display =
                    "none";

                return;

            }


            // -------------------------------------------------
            // Tooltip 内容
            // -------------------------------------------------

            tooltip.innerHTML = `

    <div
        style="
            font-size:11px;
            opacity:.7;
            margin-bottom:4px;
        "
    >
        ${formatDisplayDate(
            nearest.date
        )}
    </div>


    <div
        style="
            font-size:12px;
            opacity:.85;
            margin-bottom:3px;
        "
    >
        ${nearest.label}
    </div>


    <div
        style="
            font-size:15px;
            font-weight:700;
        "
    >
        ${formatChartTooltipValue(
    nearest.tooltipValue,
    nearest.key
)}
    </div>

`;


            // -------------------------------------------------
            // 显示
            // -------------------------------------------------

            tooltip.style.display =
                "block";


            // -------------------------------------------------
            // 防止超出屏幕右边
            // -------------------------------------------------

            let left =
                event.clientX;


            const tooltipWidth =
                tooltip.offsetWidth;


            if (
                left +
                tooltipWidth +
                25 >
                window.innerWidth
            ) {

                tooltip.style.transform =
                    "translate(-100%,-50%)";


                left =
                    event.clientX - 10;

            }
            else {

                tooltip.style.transform =
                    "translate(10px,-50%)";

            }


            // -------------------------------------------------
            // 防止超出顶部
            // -------------------------------------------------

            let top =
                event.clientY;


            if (
                top < 50
            ) {

                top =
                    50;

            }


            tooltip.style.left =
                left +
                "px";


            tooltip.style.top =
                top +
                "px";

        }
    );


    // =================================================
    // 鼠标离开
    // =================================================

    canvas.addEventListener(
        "mouseleave",
        function () {

            tooltip.style.display =
                "none";

        }
    );

}


// =====================================================
// 最终版 Canvas 绘图
// =====================================================

function drawSimpleCanvasChart(
    canvas,
    labels,
    values,
    tooltipValues,
    chartKey
) {

    if (
        !canvas
    ) {

        return;

    }


    if (
        !values ||
        values.length === 0
    ) {

        return;

    }


    const rect =
        canvas.getBoundingClientRect();


    const width =
        Math.max(
            300,
            Math.floor(
                rect.width
            )
        );


    const height =
        Math.max(
            240,
            Math.floor(
                rect.height
            )
        );


    const dpr =
        window.devicePixelRatio ||
        1;


    // -------------------------------------------------
    // 设置真实 Canvas 尺寸
    // -------------------------------------------------

    canvas.width =
        width *
        dpr;


    canvas.height =
        height *
        dpr;


    const ctx =
        canvas.getContext(
            "2d"
        );


    if (
        !ctx
    ) {

        return;

    }


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    // =================================================
    // 图表区域
    // =================================================

    const paddingLeft =
        55;


    const paddingRight =
        25;


    const paddingTop =
        20;


    const paddingBottom =
        40;


    const chartWidth =
        width -
        paddingLeft -
        paddingRight;


    const chartHeight =
        height -
        paddingTop -
        paddingBottom;


    // =================================================
    // 最大最小值
    // =================================================

    let maxValue =
        Math.max(
            ...values
        );


    let minValue =
        Math.min(
            ...values
        );


    if (
        maxValue === minValue
    ) {

        if (
            maxValue === 0
        ) {

            maxValue =
                1;

            minValue =
                0;

        }
        else {

            const offset =
                Math.abs(
                    maxValue
                ) *
                0.15;


            maxValue +=
                offset;


            minValue -=
                offset;

        }

    }


    const range =
        maxValue -
        minValue;


    // =================================================
    // 网格
    // =================================================

    ctx.strokeStyle =
        "#e5e7eb";


    ctx.lineWidth =
        1;


    ctx.font =
        "12px Arial";


    ctx.fillStyle =
        "#9ca3af";


    ctx.textAlign =
        "left";


    for (
        let i = 0;
        i <= 4;
        i++
    ) {

        const ratio =
            i / 4;


        const y =
            paddingTop +
            ratio *
            chartHeight;


        ctx.beginPath();


        ctx.moveTo(
            paddingLeft,
            y
        );


        ctx.lineTo(
            width -
            paddingRight,
            y
        );


        ctx.stroke();


        const axisValue =
            maxValue -
            ratio *
            range;


        ctx.fillText(
            formatChartAxisValue(
                axisValue
            ),
            8,
            y + 4
        );

    }


    // =================================================
    // 计算点
    // =================================================

    const points =
        [];


    values.forEach(
        function (
            value,
            index
        ) {

            let x;


            if (
                values.length === 1
            ) {

                x =
                    paddingLeft +
                    chartWidth /
                    2;

            }
            else {

                x =
                    paddingLeft +
                    (
                        index /
                        (
                            values.length -
                            1
                        )
                    ) *
                    chartWidth;

            }


            const y =
                paddingTop +
                (
                    (
                        maxValue -
                        value
                    ) /
                    range
                ) *
                chartHeight;


            points.push({

                x:
                    x,

                y:
                    y,

                value:
                    value,

                label:
                    labels[index],

                tooltipValue:
                    tooltipValues[index],

                key:
                    chartKey

            });

        }
    );


    // =================================================
    // 填充区域
    // =================================================

    if (
        points.length > 1
    ) {

        ctx.beginPath();


        ctx.moveTo(
            points[0].x,
            paddingTop +
            chartHeight
        );


        points.forEach(
            function (
                point
            ) {

                ctx.lineTo(
                    point.x,
                    point.y
                );

            }
        );


        ctx.lineTo(
            points[
                points.length - 1
            ].x,
            paddingTop +
            chartHeight
        );


        ctx.closePath();


        ctx.fillStyle =
            "rgba(17,17,17,0.05)";


        ctx.fill();

    }


    // =================================================
    // 趋势线
    // =================================================

    ctx.beginPath();


    points.forEach(
        function (
            point,
            index
        ) {

            if (
                index === 0
            ) {

                ctx.moveTo(
                    point.x,
                    point.y
                );

            }
            else {

                ctx.lineTo(
                    point.x,
                    point.y
                );

            }

        }
    );


    ctx.strokeStyle =
        "#111111";


    ctx.lineWidth =
        2.5;


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    ctx.stroke();


    // =================================================
    // 数据点
    // =================================================

    points.forEach(
        function (
            point
        ) {

            ctx.beginPath();


            ctx.arc(
                point.x,
                point.y,
                3,
                0,
                Math.PI * 2
            );


            ctx.fillStyle =
                "#111111";


            ctx.fill();

        }
    );


    // =================================================
    // 日期
    // =================================================

    ctx.fillStyle =
        "#9ca3af";


    ctx.font =
        "11px Arial";


    ctx.textAlign =
        "center";


    const labelStep =
        Math.max(
            1,
            Math.ceil(
                labels.length /
                6
            )
        );


    labels.forEach(
        function (
            label,
            index
        ) {

            if (
                index %
                    labelStep !==
                    0 &&
                index !==
                    labels.length - 1
            ) {

                return;

            }


            const point =
                points[index];


            ctx.fillText(
                label,
                point.x,
                height - 12
            );

        }
    );


    // =================================================
    // Tooltip
    // =================================================

    setupCanvasTooltip(
        canvas,
        points
    );

}
// =====================================================
// 最终版趋势主渲染
// =====================================================

function renderTrendSection() {

    // -------------------------------------------------
    // 先清理重复趋势区域
    // -------------------------------------------------

    cleanupDuplicateTrendSections();


    // -------------------------------------------------
    // 获取当前数据
    // -------------------------------------------------

    let data = [];


    if (
        typeof filteredShopData !==
            "undefined" &&
        Array.isArray(
            filteredShopData
        ) &&
        filteredShopData.length > 0
    ) {

        data =
            filteredShopData;

    }
    else if (
        typeof allShopData !==
            "undefined" &&
        Array.isArray(
            allShopData
        )
    ) {

        data =
            allShopData;

    }


    // -------------------------------------------------
    // 没有数据
    // -------------------------------------------------

    if (
        !data ||
        data.length === 0
    ) {

        return;

    }


    // -------------------------------------------------
    // 按日期排序
    // -------------------------------------------------

    const sortedData =
        [...data].sort(
            function (
                a,
                b
            ) {

                return compareDates(
                    a.date,
                    b.date
                );

            }
        );


    // -------------------------------------------------
    // 渲染四组趋势
    // -------------------------------------------------

    renderSalesTrend(
        sortedData
    );


    renderTrafficTrend(
        sortedData
    );


    renderConversionTrend(
        sortedData
    );


    renderAfterSaleTrend(
        sortedData
    );


    // -------------------------------------------------
    // 绑定按钮
    // -------------------------------------------------

    bindTrendTabs();

}


// =====================================================
// 最终版趋势按钮
// =====================================================

function bindTrendTabs() {

    const buttons =
        document.querySelectorAll(
            ".shop-chart-tab"
        );


    buttons.forEach(
        function (
            button
        ) {

            // -----------------------------------------
            // 防止重复绑定
            // -----------------------------------------

            if (
                button.dataset.finalTrendBound ===
                "1"
            ) {

                return;

            }


            button.dataset.finalTrendBound =
                "1";


            button.addEventListener(
                "click",
                function () {

                    const group =
                        button.dataset.chartGroup;


                    // -------------------------------------
                    // 同组按钮取消 active
                    // -------------------------------------

                    document
                        .querySelectorAll(
                            `.shop-chart-tab[data-chart-group="${group}"]`
                        )
                        .forEach(
                            function (
                                item
                            ) {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );


                    // -------------------------------------
                    // 当前按钮 active
                    // -------------------------------------

                    button.classList.add(
                        "active"
                    );


                    // -------------------------------------
                    // 重新绘制
                    // -------------------------------------

                    renderTrendSection();

                }
            );

        }
    );

}


// =====================================================
// 页面加载后最终清理
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setTimeout(
            function () {

                cleanupDuplicateTrendSections();

                renderTrendSection();

            },
            300
        );

    }
);


// =====================================================
// 窗口尺寸变化
// 重新绘制趋势图
// =====================================================

window.addEventListener(
    "resize",
    function () {

        clearTimeout(
            window.__trendResizeTimer
        );


        window.__trendResizeTimer =
            setTimeout(
                function () {

                    renderTrendSection();

                },
                150
            );

    }
);

// =====================================================
// 删除旧版「趋势分析」模块
// =====================================================
// 保留现在正式的：
// .shop-trend-section
//
// 删除旧版：
// 趋势分析
// 查看核心经营指标最近变化
// 暂无趋势数据
// =====================================================

function removeOldTrendAnalysis() {

    const headings =
        Array.from(
            document.querySelectorAll(
                "h1, h2, h3"
            )
        );


    headings.forEach(
        function (
            heading
        ) {

            const text =
                heading.textContent
                    .replace(
                        /\s+/g,
                        ""
                    )
                    .trim();


            // -------------------------------------------------
            // 只处理标题为「趋势分析」的模块
            // -------------------------------------------------

            if (
                text !==
                "趋势分析"
            ) {

                return;

            }


            // -------------------------------------------------
            // 如果属于正式新版趋势区域
            // 就保留
            // -------------------------------------------------

            const officialTrend =
                heading.closest(
                    ".shop-trend-section"
                );


            if (
                officialTrend
            ) {

                return;

            }


            // -------------------------------------------------
            // 找旧版模块最外层容器
            // -------------------------------------------------

            let target =
                heading.closest(
                    ".shop-card"
                );


            // -------------------------------------------------
            // 如果不是 shop-card
            // 再向上寻找合适的 section
            // -------------------------------------------------

            if (
                !target
            ) {

                target =
                    heading.closest(
                        "section"
                    );

            }


            // -------------------------------------------------
            // 还找不到
            // 就取 heading 的父级
            // -------------------------------------------------

            if (
                !target
            ) {

                target =
                    heading.parentElement;

            }


            // -------------------------------------------------
            // 删除旧版趋势模块
            // -------------------------------------------------

            if (
                target
            ) {

                target.remove();

            }

        }
    );

}


// =====================================================
// 页面加载后执行
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setTimeout(
            function () {

                removeOldTrendAnalysis();

            },
            100
        );

    }
);

// =====================================================
// Excel 日期解析最终修正版
// =====================================================
// 解决：
// 08/12/2026 被识别成 2026-12-08
//
// 当前 TikTok Shop 导出的日期格式：
// MM/DD/YYYY
//
// 所以：
// 08/12/2026 = 2026-08-12
// 08/13/2026 = 2026-08-13
// 08/14/2026 = 2026-08-14
// =====================================================

function normalizeExcelDate(
    value
) {

    // =================================================
    // 空值
    // =================================================

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    // =================================================
    // Excel 数字日期
    // =================================================

    if (
        typeof value === "number"
    ) {

        const excelEpoch =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                )
            );


        const date =
            new Date(
                excelEpoch.getTime() +
                value *
                86400000
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return (
            date.getUTCFullYear() +
            "-" +
            String(
                date.getUTCMonth() + 1
            ).padStart(
                2,
                "0"
            ) +
            "-" +
            String(
                date.getUTCDate()
            ).padStart(
                2,
                "0"
            )
        );

    }


    // =================================================
    // Excel 已经识别成 Date
    // =================================================

    if (
        value instanceof Date &&
        !isNaN(
            value.getTime()
        )
    ) {

        return formatLocalDate(
            value
        );

    }


    // =================================================
    // 文本日期
    // =================================================

    let text =
        String(
            value
        )
        .trim()
        .replace(
            /\s+/g,
            ""
        );


    // =================================================
    // YYYY-MM-DD
    // =================================================

    let match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );


    if (
        match
    ) {

        return buildDateString(
            Number(
                match[1]
            ),
            Number(
                match[2]
            ),
            Number(
                match[3]
            )
        );

    }


    // =================================================
    // YYYY/MM/DD
    // =================================================

    match =
        text.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})/
        );


    if (
        match
    ) {

        return buildDateString(
            Number(
                match[1]
            ),
            Number(
                match[2]
            ),
            Number(
                match[3]
            )
        );

    }


    // =================================================
    // MM/DD/YYYY
    //
    // TikTok Shop 当前文件使用这个格式
    //
    // 08/12/2026
    // ↓
    // 2026-08-12
    //
    // =================================================

    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (
        match
    ) {

        const month =
            Number(
                match[1]
            );


        const day =
            Number(
                match[2]
            );


        const year =
            Number(
                match[3]
            );


        // -------------------------------------------------
        // 基本合法性检查
        // -------------------------------------------------

        if (
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31
        ) {

            return null;

        }


        return buildDateString(
            year,
            month,
            day
        );

    }


    // =================================================
    // YYYY.MM.DD
    // =================================================

    match =
        text.match(
            /^(\d{4})\.(\d{1,2})\.(\d{1,2})/
        );


    if (
        match
    ) {

        return buildDateString(
            Number(
                match[1]
            ),
            Number(
                match[2]
            ),
            Number(
                match[3]
            )
        );

    }


    // =================================================
    // 无法识别
    // =================================================

    console.warn(
        "无法识别 Excel 日期：",
        value
    );


    return null;

}

// =====================================================
// 【最终日期修复】强制覆盖旧版 normalizeExcelDate
// =====================================================
//
// TikTok Shop Excel：
// 08/12/2026 = 2026-08-12
// 08/13/2026 = 2026-08-13
// 08/14/2026 = 2026-08-14
//
// 绝对不再使用 DD/MM/YYYY 判断
// =====================================================

normalizeExcelDate = function (value) {

    console.log(
        "【日期解析】原始值：",
        value,
        "类型：",
        Object.prototype.toString.call(value)
    );


    // =================================================
    // 空值
    // =================================================

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    // =================================================
    // 1. Excel 数字日期
    // =================================================

    if (
        typeof value === "number"
    ) {

        const excelEpoch =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                )
            );


        const date =
            new Date(
                excelEpoch.getTime() +
                value *
                86400000
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        const result =
            date.getUTCFullYear() +
            "-" +
            String(
                date.getUTCMonth() + 1
            ).padStart(
                2,
                "0"
            ) +
            "-" +
            String(
                date.getUTCDate()
            ).padStart(
                2,
                "0"
            );


        console.log(
            "【日期解析】Excel数字日期 →",
            result
        );


        return result;

    }


    // =================================================
    // 2. JavaScript Date 对象
    // =================================================

    if (
        value instanceof Date
    ) {

        if (
            isNaN(
                value.getTime()
            )
        ) {

            return null;

        }


        const result =
            value.getFullYear() +
            "-" +
            String(
                value.getMonth() + 1
            ).padStart(
                2,
                "0"
            ) +
            "-" +
            String(
                value.getDate()
            ).padStart(
                2,
                "0"
            );


        console.log(
            "【日期解析】Date对象 →",
            result
        );


        return result;

    }


    // =================================================
    // 3. 转成文本
    // =================================================

    let text =
        String(
            value
        )
        .trim()
        .replace(
            /\s+/g,
            ""
        );


    console.log(
        "【日期解析】文本：",
        text
    );


    // =================================================
    // 4. YYYY-MM-DD
    // =================================================

    let match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );


    if (
        match
    ) {

        const year =
            Number(
                match[1]
            );


        const month =
            Number(
                match[2]
            );


        const day =
            Number(
                match[3]
            );


        const result =
            buildDateString(
                year,
                month,
                day
            );


        console.log(
            "【日期解析】YYYY-MM-DD →",
            result
        );


        return result;

    }


    // =================================================
    // 5. YYYY/MM/DD
    // =================================================

    match =
        text.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})/
        );


    if (
        match
    ) {

        const year =
            Number(
                match[1]
            );


        const month =
            Number(
                match[2]
            );


        const day =
            Number(
                match[3]
            );


        const result =
            buildDateString(
                year,
                month,
                day
            );


        console.log(
            "【日期解析】YYYY/MM/DD →",
            result
        );


        return result;

    }


    // =================================================
    // 6. MM/DD/YYYY
    // =================================================
    //
    // 重点：
    //
    // TikTok Shop 这里按照美国格式处理
    //
    // 08/12/2026
    // ↓
    // August 12, 2026
    //
    // 08/14/2026
    // ↓
    // August 14, 2026
    //
    // =================================================

    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (
        match
    ) {

        const month =
            Number(
                match[1]
            );


        const day =
            Number(
                match[2]
            );


        const year =
            Number(
                match[3]
            );


        // -------------------------------------------------
        // 严格按照 MM/DD/YYYY
        // -------------------------------------------------

        if (
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31
        ) {

            console.error(
                "【日期解析失败】非法日期：",
                text
            );


            return null;

        }


        const result =
            buildDateString(
                year,
                month,
                day
            );


        console.log(
            "【日期解析】MM/DD/YYYY →",
            result
        );


        return result;

    }


    // =================================================
    // 7. YYYY.MM.DD
    // =================================================

    match =
        text.match(
            /^(\d{4})\.(\d{1,2})\.(\d{1,2})/
        );


    if (
        match
    ) {

        const year =
            Number(
                match[1]
            );


        const month =
            Number(
                match[2]
            );


        const day =
            Number(
                match[3]
            );


        const result =
            buildDateString(
                year,
                month,
                day
            );


        console.log(
            "【日期解析】YYYY.MM.DD →",
            result
        );


        return result;

    }


    // =================================================
    // 无法识别
    // =================================================

    console.error(
        "【日期解析失败】无法识别：",
        value
    );


    return null;

};

// =====================================================
// TikTok Shop「分析日期」专用解析
// =====================================================
//
// TikTok 导出的分析日期：
// 12/08/2026
//
// 实际含义：
// 2026年8月12日
//
// 所以这里明确按照：
// DD/MM/YYYY
//
// 不再交给通用 normalizeExcelDate()
// =====================================================

function parseTikTokAnalysisDate(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    let text =
        String(
            value
        )
        .trim()
        .replace(
            /\s+/g,
            ""
        );


    console.log(
        "【TikTok分析日期】原始值：",
        text
    );


    // =================================================
    // 处理：
    //
    // 12/08/2026
    //
    // = 2026-08-12
    // =================================================

    const match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (
        !match
    ) {

        console.error(
            "【TikTok分析日期】无法识别：",
            text
        );


        return null;

    }


    const day =
        Number(
            match[1]
        );


    const month =
        Number(
            match[2]
        );


    const year =
        Number(
            match[3]
        );


    // =================================================
    // 合法性检查
    // =================================================

    if (
        day < 1 ||
        day > 31 ||
        month < 1 ||
        month > 12
    ) {

        console.error(
            "【TikTok分析日期】日期非法：",
            text
        );


        return null;

    }


    const result =
        buildDateString(
            year,
            month,
            day
        );


    console.log(
        "【TikTok分析日期】解析结果：",
        result
    );


    return result;

}

// =====================================================
// TikTok Shop 日期专用解析
// =====================================================
//
// TikTok Shop Excel 实际格式：
//
// 12/08/2026
//
// 含义：
// 2026年8月12日
//
// 即：
// DD/MM/YYYY
//
// =====================================================

function parseTikTokDate(
    value
) {

    console.log(
        "TikTok日期原始值：",
        value,
        "类型：",
        typeof value
    );


    // =================================================
    // 空值
    // =================================================

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    // =================================================
    // 如果是数字
    // =================================================

    if (
        typeof value === "number"
    ) {

        const excelEpoch =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                )
            );


        const date =
            new Date(
                excelEpoch.getTime() +
                value *
                86400000
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        const result =
            buildDateString(
                date.getUTCFullYear(),
                date.getUTCMonth() + 1,
                date.getUTCDate()
            );


        console.log(
            "TikTok日期数字解析结果：",
            result
        );


        return result;

    }


    // =================================================
    // 转字符串
    // =================================================

    let text =
        String(
            value
        )
        .trim()
        .replace(
            /\s+/g,
            ""
        );


    // =================================================
    // 如果是：
    //
    // 12/08/2026-12/08/2026
    //
    // 只取前面的日期
    // =================================================

    if (
        text.includes("-")
    ) {

        text =
            text.split(
                "-"
            )[0];

    }


    if (
        text.includes("至")
    ) {

        text =
            text.split(
                "至"
            )[0];

    }


    if (
        text.includes("~")
    ) {

        text =
            text.split(
                "~"
            )[0];

    }


    text =
        text.trim();


    console.log(
        "TikTok日期清理后：",
        text
    );


    // =================================================
    // YYYY-MM-DD
    // =================================================

    let match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (
        match
    ) {

        const result =
            buildDateString(
                Number(match[1]),
                Number(match[2]),
                Number(match[3])
            );


        console.log(
            "TikTok日期 YYYY-MM-DD：",
            result
        );


        return result;

    }


    // =================================================
    // YYYY/MM/DD
    // =================================================

    match =
        text.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
        );


    if (
        match
    ) {

        const result =
            buildDateString(
                Number(match[1]),
                Number(match[2]),
                Number(match[3])
            );


        console.log(
            "TikTok日期 YYYY/MM/DD：",
            result
        );


        return result;

    }


    // =================================================
    // TikTok：
    //
    // DD/MM/YYYY
    //
    // 12/08/2026
    //
    // day   = 12
    // month = 08
    // year  = 2026
    //
    // ↓
    //
    // 2026-08-12
    // =================================================

    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );


    if (
        match
    ) {

        const day =
            Number(
                match[1]
            );


        const month =
            Number(
                match[2]
            );


        const year =
            Number(
                match[3]
            );


        console.log(
            "TikTok日期拆分：",
            {
                day,
                month,
                year
            }
        );


        if (
            day < 1 ||
            day > 31
        ) {

            console.error(
                "TikTok日期：day非法",
                day
            );


            return null;

        }


        if (
            month < 1 ||
            month > 12
        ) {

            console.error(
                "TikTok日期：month非法",
                month
            );


            return null;

        }


        const result =
            buildDateString(
                year,
                month,
                day
            );


        console.log(
            "TikTok日期最终结果：",
            result
        );


        return result;

    }


    // =================================================
    // 无法识别
    // =================================================

    console.error(
        "TikTok日期无法识别：",
        value
    );


    return null;

}

// =====================================================
// 趋势图 Tooltip 最终版
// 不需要修改原来的 Tooltip
// 直接在文件底部覆盖
// =====================================================

function formatPercent(value) {

    return (
        Math.round(
            Number(value) || 0
        ) +
        "%"
    );

}


function getTrendTooltipUnit(
    key
) {

    switch (
        key
    ) {

        // ================================
        // 销售
        // ================================

        case "orders":

            return " 单";


        case "units":

            return " 件";


        case "customers":

            return " 人";


        // ================================
        // 流量
        // ================================

        case "impressions":

            return " 次";


        case "clicks":

            return " 次";


        // ================================
        // 售后
        // ================================

        case "cancelledReturned":

            return " 件";


        default:

            return "";

    }

}

function showTrendTooltip(
    canvas,
    point,
    config,
    x,
    y
) {

    let tooltip =
        canvas.parentElement.querySelector(
            ".shop-chart-tooltip"
        );


    if (!tooltip) {

        tooltip =
            document.createElement(
                "div"
            );


        tooltip.className =
            "shop-chart-tooltip";


        tooltip.style.position =
            "absolute";


        tooltip.style.pointerEvents =
            "none";


        tooltip.style.background =
            "rgba(17,17,17,0.94)";


        tooltip.style.color =
            "#fff";


        tooltip.style.padding =
            "9px 12px";


        tooltip.style.borderRadius =
            "9px";


        tooltip.style.fontSize =
            "12px";


        tooltip.style.lineHeight =
            "1.5";


        tooltip.style.whiteSpace =
            "nowrap";


        tooltip.style.zIndex =
            "9999";


        tooltip.style.boxShadow =
            "0 6px 20px rgba(0,0,0,0.18)";


        canvas.parentElement.appendChild(
            tooltip
        );

    }


    // =================================================
    // 指标格式
    // =================================================

    const format =
        config.formats[
            config.key
        ];


    // =================================================
    // 指标名称
    // =================================================

    const label =
        config.labels &&
        config.labels[
            config.key
        ]
            ? config.labels[
                config.key
            ]
            : config.key;


    // =================================================
    // 数值
    // =================================================

    let valueText = "";


    if (
        format === "money"
    ) {

        valueText =
            formatMoney(
                point.value
            );

    }
    else if (
        format === "percent"
    ) {

        valueText =
            formatPercent(
                point.value
            );

    }
    else {

        valueText =
            formatNumber(
                point.value
            );

    }


    // =================================================
    // 单位
    // =================================================

    let unit = "";


    switch (
        config.key
    ) {

        case "orders":

            unit = " 单";

            break;


        case "units":

            unit = " 件";

            break;


        case "customers":

            unit = " 人";

            break;


        case "impressions":

            unit = " 次";

            break;


        case "clicks":

            unit = " 次";

            break;


        case "cancelledReturned":

            unit = " 件";

            break;


        default:

            unit = "";

            break;

    }


    // =================================================
    // 最终显示
    // =================================================

    const finalValue =
        valueText +
        unit;


    // =================================================
    // Tooltip 内容
    // =================================================

    tooltip.innerHTML =

        `<div style="
            font-size:11px;
            opacity:.7;
            margin-bottom:3px;
        ">
            ${escapeHtml(
                formatDisplayDate(
                    point.date
                )
            )}
        </div>` +

        `<div style="
            font-size:12px;
            opacity:.82;
            margin-bottom:2px;
        ">
            ${escapeHtml(
                label
            )}
        </div>` +

        `<div style="
            font-size:14px;
            font-weight:700;
        ">
            ${escapeHtml(
                finalValue
            )}
        </div>`;


    // =================================================
    // 位置
    // =================================================

    const parentWidth =
        canvas.parentElement.clientWidth;


    const tooltipWidth =
        tooltip.offsetWidth;


    let left =
        x -
        tooltipWidth / 2;


    left =
        Math.max(
            8,
            left
        );


    left =
        Math.min(
            left,
            parentWidth -
            tooltipWidth -
            8
        );


    tooltip.style.left =
        left +
        "px";


    tooltip.style.top =
        Math.max(
            8,
            y - 72
        ) +
        "px";

}