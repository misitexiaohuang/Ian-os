// =====================================================
// shop-data.js
// TikTok Shop 店铺数据
// 完整稳定版
// =====================================================

console.log("shop-data.js 开始加载");


// =====================================================
// 全局变量
// =====================================================

let allShopData = [];

// ===============================
// 运营事件
// ===============================

let shopEvents = [];

let filteredShopData = [];

let selectedStartDate = null;

let selectedEndDate = null;

let tempStartDate = null;

let tempEndDate = null;

let hoverDate = null;

let currentCalendarDate = new Date();

// 拖拽选择的文件缓存
let dragFiles = [];

// 上传预览缓存
let uploadPreviewFiles = [];

// V4 上传历史
let uploadHistory = JSON.parse(
    localStorage.getItem("shopUploadHistory") || "[]"
);

// 上传进度
let uploadProgress = {
    total:0,
    current:0
};

// 上传结果记录
let uploadResult = {
    insert:0,
    update:0,
    fail:0
};


// =====================================================
// 页面初始化
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initShopDataPage();

        bindEventEvents();

        bindConfirmDeleteEvent();

        loadShopEvents();

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

    bindTrendChartEvents();

}


// =====================================================
// 获取 Supabase Client
// =====================================================

function getSupabaseClient() {

    if (window.supabaseClient) {

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
        document.getElementById("excelFile");

    const uploadBtn =
        document.getElementById("uploadBtn");

        // =====================================================
// 拖拽上传 Excel
// =====================================================

const dropZone =
    document.getElementById(
        "dropZone"
    );


if(dropZone){


    // 鼠标进入

    dropZone.addEventListener(
        "dragover",
        function(e){

            e.preventDefault();


            dropZone.classList.add(
                "dragover"
            );

        }
    );



    // 离开

    dropZone.addEventListener(
        "dragleave",
        function(){

            dropZone.classList.remove(
                "dragover"
            );

        }
    );



    // 松手

    dropZone.addEventListener(
        "drop",
        function(e){

            e.preventDefault();


            dropZone.classList.remove(
                "dragover"
            );



            const files =
                Array.from(
                    e.dataTransfer.files
                )
                .filter(
                    file =>
                    file.name.endsWith(".xlsx") ||
                    file.name.endsWith(".xls")
                );



            if(
                files.length === 0
            ){

                alert(
                    "请拖入 Excel 文件"
                );

                return;

            }



            // 关键：
            // 模拟用户选择文件

            const dataTransfer =
                new DataTransfer();



            files.forEach(
                function(file){

                    dataTransfer.items.add(
                        file
                    );

                }
            );



            fileInput.files =
                dataTransfer.files;


            uploadPreviewFiles = files;

            renderUploadPreview(files);



            // 更新显示

            const selectedFile =
                document.getElementById(
                    "selectedFile"
                );


            if(selectedFile){

                selectedFile.innerHTML =
                    `
                    <div style="font-weight:600;margin-bottom:6px;">
                        已选择 ${files.length} 个 Excel 文件：
                    </div>

                    ${
                        files.map(
                            file =>
                            `
                            <div style="margin-top:4px;">
                                ✅ ${file.name}
                            </div>
                            `
                        ).join("")
                    }
                    `;

            }


        }
    );


}


    if (fileInput) {

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

                    selectedFile.innerHTML =
                        `
                        <div style="font-weight:600;margin-bottom:6px;">
                            已选择 ${fileInput.files.length} 个 Excel 文件：
                        </div>

                        ${
                            Array.from(fileInput.files)
                            .map(
                                file =>
                                `
                                <div style="margin-top:4px;">
                                    ✅ ${file.name}
                                </div>
                                `
                            )
                            .join("")
                        }
                        `;

                    renderUploadPreview(
                        Array.from(fileInput.files)
                    );

                } else {

                    selectedFile.textContent =
                        "尚未选择文件";

                }

            }
        );

    }


    if (uploadBtn) {

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

    const fileInput = document.getElementById("excelFile");
    const uploadBtn = document.getElementById("uploadBtn");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showUploadStatus("请先选择 Excel 文件", "error");
        return;
    }

    try {

        uploadBtn.disabled = true;

        const files = Array.from(fileInput.files);

        let insertCount = 0;
        let updateCount = 0;
        let failCount = 0;

        uploadProgress.total = files.length;
        uploadProgress.current = 0;

        uploadResult = {
            insert:0,
            update:0,
            fail:0
        };

        showUploadStatus(
            `正在批量读取 ${files.length} 个 Excel...`,
            "loading"
        );

        let lastItem = null;

        for (let i = 0; i < files.length; i++) {

            const file = files[i];

            try {

                showUploadStatus(
                    `正在处理 ${i + 1}/${files.length} (${Math.round(((i + 1) / files.length) * 100)}%): ${file.name}`,
                    "loading"
                );

                const arrayBuffer = await file.arrayBuffer();

                const workbook = XLSX.read(arrayBuffer, {
                    type: "array",
                    cellDates: true
                });

                let parsedRows = [];

                for (const sheetName of workbook.SheetNames) {

                    const worksheet = workbook.Sheets[sheetName];

                    const rows = XLSX.utils.sheet_to_json(
                        worksheet,
                        {
                            header:1,
                            defval:"",
                            raw:true
                        }
                    );

                    const parsed = parseExcelDailyData(rows, file.name);

                    if (parsed && parsed.length > 0) {
                        parsedRows = parsed;
                        break;
                    }
                }

                for (const item of parsedRows) {

                    const result = await saveShopData(item);

                    if (result === "insert") insertCount++;
                    if (result === "update") updateCount++;

                    lastItem = item;
                }

            } catch(err) {

                console.error(file.name, err);
                failCount++;

            }
        }

        await loadShopData();

        if (lastItem) {
            renderPreview(lastItem);
        }

        showUploadStatus(
            `批量导入完成！新增 ${insertCount} 天，更新 ${updateCount} 天，失败 ${failCount} 个文件。`,
            "success"
        );

        renderUploadResult(
            insertCount,
            updateCount,
            failCount
        );

        saveUploadHistory(
            files.length,
            insertCount,
            updateCount,
            failCount
        );

    } catch(error) {

        console.error("批量上传失败：", error);

        showUploadStatus(
            "上传失败：" + error.message,
            "error"
        );

    } finally {

        uploadBtn.disabled = false;

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

            headerIndex = i;

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


                if (key) {

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
                normalizeExcelDate(
                    rawDate
                );


            if (!date) {

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
    //
    // 今日数据
    // 00:00...
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
                        normalizeExcelDate(
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

            totalRowIndex = i;

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

                totalRowIndex = i;

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

            headerRowIndex = i;

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


            if (key) {

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

function normalizeExcelDate(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


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


    let text =
        String(
            value
        )
        .trim()
        .replace(
            /\s+/g,
            ""
        );


    let match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );


    if (match) {

        return buildDateString(
            Number(match[1]),
            Number(match[2]),
            Number(match[3])
        );

    }


    match =
        text.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})/
        );


    if (match) {

        return buildDateString(
            Number(match[1]),
            Number(match[2]),
            Number(match[3])
        );

    }


    match =
        text.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
        );


    if (match) {

        const first =
            Number(match[1]);


        const second =
            Number(match[2]);


        const year =
            Number(match[3]);


        if (first > 12) {

            return buildDateString(
                year,
                second,
                first
            );

        }


        if (second > 12) {

            return buildDateString(
                year,
                first,
                second
            );

        }


        // TikTok 当前格式：
        // DD/MM/YYYY

        return buildDateString(
            year,
            second,
            first
        );

    }


    return null;

}


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
        String(month).padStart(
            2,
            "0"
        ) +
        "-" +
        String(day).padStart(
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


    if (!client) {

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


    if (selectError) {

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


        if (error) {

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


    if (error) {

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


    if (!client) {

        showHistoryEmpty(
            "Supabase 连接不存在"
        );

        return;

    }


    showHistoryLoading(true);


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


        if (error) {

            throw error;

        }


        allShopData =
            (
                data || []
            ).map(
                normalizeDatabaseRow
            );


        // 初次进入页面不展示全部历史数据
        // 等用户选择日期范围后再渲染分析结果

        updateOverview([]);

        renderAllTrendCharts([]);

        renderHistoryTable([]);

        showHistoryLoading(false);


    } catch (error) {

        console.error(
            "读取店铺数据失败：",
            error
        );


        showHistoryLoading(false);


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
            toNumber(row.gmv),

        orders:
            toNumber(row.orders),

        customers:
            toNumber(row.customers),

        units_sold:
            toNumber(row.units_sold),

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


    if (button) {

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

                } else {

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


    if (prevMonth) {

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


    if (nextMonth) {

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


    if (cancel) {

        cancel.addEventListener(
            "click",
            function () {

                closeDatePicker();

            }
        );

    }


    if (confirm) {

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

                } else {

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
// 重要修复：
//
// 鼠标 hover 时不再 renderCalendar()
// 不再重新创建 DOM
//
// 这样结束日期按钮就不会消失
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


        button.type = "button";


        button.className =
            "shop-calendar-day";


        button.textContent =
            day;


        button.dataset.date =
            dateString;


        if (otherMonth) {

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


        // =================================================
        // 鼠标进入
        //
        // 不重新生成日历
        // 只更新 class
        // =================================================

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


        // =================================================
        // 鼠标点击
        // =================================================

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
//
// 关键修复：
// 不重新 renderCalendar()
// 直接给已有按钮加 class
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

        } else {

            tempEndDate =
                dateString;

        }


        hoverDate = null;


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

        start = today;

        end = today;

    }

    else if (
        type === "yesterday"
    ) {

        start =
            new Date(today);


        start.setDate(
            start.getDate() - 1
        );


        end =
            new Date(start);

    }

    else if (
        type === "7days"
    ) {

        end = today;


        start =
            new Date(today);


        start.setDate(
            start.getDate() - 6
        );

    }

    else if (
        type === "30days"
    ) {

        end = today;


        start =
            new Date(today);


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


        end = today;

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
        formatLocalDate(start);


    tempEndDate =
        formatLocalDate(end);


    hoverDate = null;


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

    } else {

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


    if (queryBtn) {

        queryBtn.addEventListener(
            "click",
            applyDateFilter
        );

    }


    if (resetBtn) {

        resetBtn.addEventListener(
            "click",
            function () {

                selectedStartDate = null;

                selectedEndDate = null;

                tempStartDate = null;

                tempEndDate = null;

                hoverDate = null;


                updateDateRangeText();


                updateOverview([]);

                renderAllTrendCharts([]);

                renderHistoryTable([]);


                const text =
                    document.getElementById(
                        "overviewDateText"
                    );


                if (text) {

                    text.textContent =
                        "请选择日期范围";

                }

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

    renderAllTrendCharts(
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

    // =================================================
    // 未选择日期时，经营总览保持空白
    // 防止页面刚打开时把全部历史数据误显示为当前查询结果
    // =================================================

    if (
        !selectedStartDate ||
        !selectedEndDate
    ) {

        setText("totalGMV", "--");
        setText("totalOrders", "--");
        setText("totalUnits", "--");
        setText("totalCustomers", "--");
        setText("totalAOV", "--");
        setText("totalRefund", "--");
        setText("totalImpressions", "--");
        setText("totalClicks", "--");
        setText("totalCTR", "--");

        return;

    }

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
        formatMoney(totalGMV)
    );


    setText(
        "totalOrders",
        formatNumber(totalOrders)
    );


    setText(
        "totalUnits",
        formatNumber(totalUnits)
    );


    setText(
        "totalCustomers",
        formatNumber(totalCustomers)
    );


    setText(
        "totalAOV",
        formatMoney(totalAOV)
    );


    setText(
        "totalRefund",
        formatMoney(totalRefund)
    );


    setText(
        "totalImpressions",
        formatNumber(totalImpressions)
    );


    setText(
        "totalClicks",
        formatNumber(totalClicks)
    );


    setText(
        "totalCTR",
        formatPercent(totalCTR)
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
        formatMoney(item.gmv)
    );


    setText(
        "previewOrders",
        formatNumber(item.orders)
    );


    setText(
        "previewUnits",
        formatNumber(item.units_sold)
    );


    setText(
        "previewCustomers",
        formatNumber(item.customers)
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
        formatPercent(item.ctr)
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


    tbody.innerHTML = "";


    if (
        !data ||
        data.length === 0
    ) {

        if (empty) {

            empty.style.display =
                "block";

            empty.textContent =
                "请选择日期范围查看数据";

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


    data.forEach(
        function (item) {

            gmv +=
                toNumber(item.gmv);

            orders +=
                toNumber(item.orders);

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

    if (!dateString) {

        return new Date(NaN);

    }


    const parts =
        String(
            dateString
        )
        .substring(
            0,
            10
        )
        .split("-");


    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
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

    if (!dateString) {

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

function formatPercent(
    value
) {

    return (
        toNumber(
            value
        ).toFixed(2) +
        "%"
    );

}


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


    if (element) {

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
// 空数据
// =====================================================

function showHistoryEmpty(
    message
) {

    const empty =
        document.getElementById(
            "historyEmpty"
        );


    const wrapper =
        document.getElementById(
            "historyTableWrapper"
        );


    if (empty) {

        empty.style.display =
            "block";

        empty.textContent =
            message;

    }


    if (wrapper) {

        wrapper.style.display =
            "none";

    }

}


// =====================================================
// HTML 转义
// =====================================================

function escapeHtml(
    value
) {

    return String(
        value
    )
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



// =====================================================
// 趋势图表
// =====================================================

let activeTrendKeys = {
    sales: "gmv",
    traffic: "impressions",
    conversion: "orderConversion",
    afterSale: "refund"
};


// =====================================================
// 绑定趋势图按钮
// =====================================================

function bindTrendChartEvents() {

    document
        .querySelectorAll(
            ".shop-chart-tab"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const group =
                            button.dataset.chartGroup;

                        const key =
                            button.dataset.chartKey;


                        if (!group || !key) {
                            return;
                        }


                        activeTrendKeys[group] = key;


                        document
                            .querySelectorAll(
                                `.shop-chart-tab[data-chart-group="${group}"]`
                            )
                            .forEach(
                                function (item) {

                                    item.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        renderTrendGroup(
                            group,
                            allShopData
                        );

                    }
                );

            }
        );

}


// =====================================================
// 所有趋势图
// =====================================================

function renderAllTrendCharts(
    data
) {

    renderTrendGroup(
        "sales",
        data
    );

    renderTrendGroup(
        "traffic",
        data
    );

    renderTrendGroup(
        "conversion",
        data
    );

    renderTrendGroup(
        "afterSale",
        data
    );

}


// =====================================================
// 单个趋势组
// =====================================================

function renderTrendGroup(
    group,
    data
) {

    const config =
        getTrendConfig(
            group,
            activeTrendKeys[group]
        );


    if (!config) {
        return;
    }


    const canvas =
        document.getElementById(
            config.canvasId
        );


    const empty =
        document.getElementById(
            config.emptyId
        );


    if (!canvas) {
        return;
    }


    if (!data || data.length === 0) {

        clearCanvas(canvas);

        if (empty) {
            empty.style.display = "flex";
        }

        return;

    }


    if (empty) {
        empty.style.display = "none";
    }


    const sorted =
        [...data].sort(
            function (a, b) {
                return compareDates(
                    a.date,
                    b.date
                );
            }
        );


    const points =
        sorted.map(
            function (item) {
                return {
                    date: item.date,
                    value: getTrendValue(
                        item,
                        config.key
                    )
                };
            }
        );



    drawTrendChart(
    canvas,
    points,
    config,
    group === "sales"
        ? shopEvents
        : []
);

}


// =====================================================
// 趋势配置
// =====================================================

function getTrendConfig(
    group,
    key
) {

    const configs = {

        sales: {
            canvasId: "salesChart",
            emptyId: "salesChartEmpty",
            key: key,
            labels: {
                gmv: "GMV",
                orders: "订单",
                units: "销量",
                customers: "客户",
                aov: "客单价"
            },
            formats: {
                gmv: "money",
                orders: "number",
                units: "number",
                customers: "number",
                aov: "money"
            }
        },

        traffic: {
            canvasId: "trafficChart",
            emptyId: "trafficChartEmpty",
            key: key,
            labels: {
                impressions: "商品曝光",
                clicks: "商品点击",
                ctr: "CTR"
            },
            formats: {
                impressions: "number",
                clicks: "number",
                ctr: "percent"
            }
        },

        conversion: {
            canvasId: "conversionChart",
            emptyId: "conversionChartEmpty",
            key: key,
            labels: {
                orderConversion: "订单转化率",
                productConversion: "商品成交转化率",
                gmvPerThousand: "GMV / 千曝光",
                gmvPerClick: "GMV / 点击"
            },
            formats: {
                orderConversion: "percent",
                productConversion: "percent",
                gmvPerThousand: "money",
                gmvPerClick: "money"
            }
        },

        afterSale: {
            canvasId: "afterSaleChart",
            emptyId: "afterSaleChartEmpty",
            key: key,
            labels: {
                refund: "退款金额",
                refundRate: "退款率",
                cancelledReturned: "取消/退货",
                cancelledReturnedRate: "取消/退货率"
            },
            formats: {
                refund: "money",
                refundRate: "percent",
                cancelledReturned: "number",
                cancelledReturnedRate: "percent"
            }
        }

    };


    return configs[group] || null;

}


// =====================================================
// 趋势指标计算
// =====================================================

function getTrendValue(
    item,
    key
) {

    const gmv =
        toNumber(item.gmv);

    const orders =
        toNumber(item.orders);

    const units =
        toNumber(item.units_sold);

    const clicks =
        toNumber(item.product_clicks);

    const impressions =
        toNumber(item.product_impressions);

    const refund =
        toNumber(item.refund_amount);

    const cancelledReturned =
        toNumber(
            item.cancelled_returned_units
        );


    switch (key) {

        case "gmv":
            return gmv;

        case "orders":
            return orders;

        case "units":
            return units;

        case "customers":
            return toNumber(
                item.customers
            );

        case "aov":
            return orders > 0
                ? gmv / orders
                : 0;

        case "impressions":
            return impressions;

        case "clicks":
            return clicks;

        case "ctr":
            return impressions > 0
                ? (clicks / impressions) * 100
                : 0;

        // 订单转化率：订单 ÷ 商品点击
        case "orderConversion":
            return clicks > 0
                ? (orders / clicks) * 100
                : 0;

        // 商品成交转化率：商品成交件数 ÷ 商品点击
        case "productConversion":
            return clicks > 0
                ? (units / clicks) * 100
                : 0;

        // GMV / 千曝光
        case "gmvPerThousand":
            return impressions > 0
                ? (gmv / impressions) * 1000
                : 0;

        // GMV / 点击
        case "gmvPerClick":
            return clicks > 0
                ? gmv / clicks
                : 0;

        case "refund":
            return refund;

        // 退款率：退款金额 ÷ GMV
        case "refundRate":
            return gmv > 0
                ? (refund / gmv) * 100
                : 0;

        case "cancelledReturned":
            return cancelledReturned;

        // 取消/退货率：取消退货件数 ÷ 商品成交件数
        case "cancelledReturnedRate":
            return units > 0
                ? (cancelledReturned / units) * 100
                : 0;

        default:
            return 0;

    }

}


// =====================================================
// Canvas 趋势图
// =====================================================

function drawTrendChart(
    canvas,
    points,
    config,
    events = []
){

    const rect =
        canvas.getBoundingClientRect();

    const width =
        Math.max(
            300,
            Math.floor(rect.width)
        );

    const height =
        Math.max(
            220,
            Math.floor(rect.height)
        );

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;


    const ctx =
        canvas.getContext("2d");


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


    const padding = {
        left: 58,
        right: 22,
        top: 24,
        bottom: 42
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
        points.map(
            function (item) {
                return Number(item.value) || 0;
            }
        );


    let minValue =
        Math.min(...values);

    let maxValue =
        Math.max(...values);


    if (
        minValue === maxValue
    ) {

        if (minValue === 0) {
            maxValue = 1;
        } else {
            const extra =
                Math.abs(minValue) * 0.2;
            minValue -= extra;
            maxValue += extra;
        }

    }


    const range =
        maxValue - minValue;


    minValue -= range * 0.08;
    maxValue += range * 0.08;


    const zeroValue =
        0 >= minValue && 0 <= maxValue
            ? 0
            : null;


    function xPosition(index) {

        if (points.length === 1) {
            return padding.left + chartWidth / 2;
        }

        return (
            padding.left +
            (index / (points.length - 1)) * chartWidth
        );

    }


    function yPosition(value) {

        return (
            padding.top +
            chartHeight -
            ((value - minValue) / (maxValue - minValue)) * chartHeight
        );

    }


    // 网格线
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e9e9e9";
    ctx.fillStyle = "#999";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";


    const gridCount = 5;


    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const y =
            padding.top +
            (i / gridCount) * chartHeight;

        const value =
            maxValue -
            (i / gridCount) * (maxValue - minValue);


        ctx.beginPath();
        ctx.moveTo(
            padding.left,
            y
        );
        ctx.lineTo(
            width - padding.right,
            y
        );
        ctx.stroke();


        ctx.fillText(
            formatChartAxisValue(
                value,
                config.formats[config.key]
            ),
            padding.left - 10,
            y
        );

    }


    // 0 基线
    if (zeroValue !== null) {

        const y =
            yPosition(0);

        ctx.beginPath();
        ctx.moveTo(
            padding.left,
            y
        );
        ctx.lineTo(
            width - padding.right,
            y
        );
        ctx.strokeStyle = "#d8d8d8";
        ctx.stroke();

    }


    // 日期轴
    ctx.fillStyle = "#999";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";


    const labelIndexes =
        getChartLabelIndexes(
            points.length
        );


    labelIndexes.forEach(
        function (index) {

            ctx.fillText(
                formatShortDate(
                    points[index].date
                ),
                xPosition(index),
                height - padding.bottom + 14
            );

        }
    );


    // 折线
    ctx.beginPath();

    points.forEach(
        function (point, index) {

            const x =
                xPosition(index);

            const y =
                yPosition(
                    Number(point.value) || 0
                );


            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

        }
    );


    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();


    // 数据点
    points.forEach(
        function (point, index) {

            const x =
                xPosition(index);

            const y =
                yPosition(
                    Number(point.value) || 0
                );


            ctx.beginPath();
            ctx.arc(
                x,
                y,
                3.2,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = "#111";
            ctx.fill();

            // =================================================
// 运营事件标记
// =================================================

if(events && events.length > 0){


    events.forEach(
        function(event){


            const index =
                points.findIndex(
                    function(point){

                        return (
                            point.date === event.date
                        );

                    }
                );


            if(index === -1){
                return;
            }



            const x =
                xPosition(index);



            const y =
                yPosition(
                    Number(
                        points[index].value
                    ) || 0
                );



            drawEventStar(
                ctx,
                x,
                y - 22,
                event.impact
            );


        }
    );


}

        }
    );


    // 图表标题
    ctx.fillStyle = "#555";
    ctx.font = "600 13px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillText(
        config.labels[config.key] || "",
        padding.left,
        5
    );


    // =================================================
    // Hover 数据
    // =================================================

    if (canvas._trendMouseHandler) {

        canvas.removeEventListener(
            "mousemove",
            canvas._trendMouseHandler
        );

        canvas.removeEventListener(
            "mouseleave",
            canvas._trendLeaveHandler
        );

    }


    canvas._trendMouseHandler =
        function (event) {


            const bounds =
                canvas.getBoundingClientRect();


            const mouseX =
                event.clientX - bounds.left;


            const mouseY =
                event.clientY - bounds.top;



            let nearestIndex = 0;

            let nearestDistance = Infinity;



            points.forEach(
                function(point,index){

                    const distance =
                        Math.abs(
                            mouseX - xPosition(index)
                        );


                    if(
                        distance < nearestDistance
                    ){

                        nearestDistance = distance;
                        nearestIndex = index;

                    }

                }
            );



            if(
                nearestDistance > 35
            ){

                removeTrendTooltip(canvas);

                return;

            }



            const point =
                points[nearestIndex];


            showTrendTooltip(
                canvas,
                point,
                config,
                xPosition(nearestIndex),
                yPosition(
                    Number(point.value) || 0
                )
            );


        };


    canvas._trendLeaveHandler =
        function () {
            removeTrendTooltip(canvas);
        };


    canvas.addEventListener(
        "mousemove",
        canvas._trendMouseHandler
    );


    canvas.addEventListener(
        "mouseleave",
        canvas._trendLeaveHandler
    );

}


// =====================================================
// Tooltip
// =====================================================

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
            "8px 10px";

        tooltip.style.borderRadius =
            "8px";

        tooltip.style.fontSize =
            "12px";

        tooltip.style.lineHeight =
            "1.5";

        tooltip.style.whiteSpace =
            "nowrap";

        tooltip.style.zIndex =
            "10";

        canvas.parentElement.appendChild(
            tooltip
        );

    }


    const format =
        config.formats[config.key];


    let valueText;


    if (format === "money") {
        valueText = formatMoney(point.value);
    }
    else if (format === "percent") {
        valueText = formatPercent(point.value);
    }
    else {
        valueText = formatNumber(point.value);
    }



    // ===============================
// 追加运营事件信息
// ===============================

let eventHtml = "";


if(
    typeof shopEvents !== "undefined" &&
    shopEvents.length > 0
){

    const relatedEvents =
        shopEvents.filter(
            function(item){

                return (
                    item.date === point.date
                );

            }
        );


    if(
        relatedEvents.length > 0
    ){

        eventHtml +=
            `<div style="
                margin-top:8px;
                padding-top:8px;
                border-top:1px solid rgba(255,255,255,.25);
            ">`;


        relatedEvents.forEach(
            function(item){


                const icon =
                    item.impact === "positive"
                    ? "🟢"
                    : "🔴";


                eventHtml +=
                    `
                    <div style="
                        margin-bottom:4px;
                    ">
                    ${icon}
                    ${escapeHtml(item.title)}
                    </div>
                    `;


            }
        );


        eventHtml +=
            `</div>`;

    }

}



tooltip.innerHTML =
    `<div>${escapeHtml(formatDisplayDate(point.date))}</div>` +
    `<strong>${escapeHtml(valueText)}</strong>` +
    eventHtml;


    const parentWidth =
        canvas.parentElement.clientWidth;


    tooltip.style.left =
        Math.min(
            Math.max(
                10,
                x - 45
            ),
            Math.max(
                10,
                parentWidth - 120
            )
        ) + "px";


    tooltip.style.top =
        Math.max(
            8,
            y - 48
        ) + "px";

}


function removeTrendTooltip(
    canvas
) {

    const tooltip =
        canvas.parentElement.querySelector(
            ".shop-chart-tooltip"
        );


    if (tooltip) {

        tooltip.remove();

    }



    // =====================================
    // 清除运营事件 Tooltip
    // =====================================

    const eventTooltip =
        document.querySelector(
            ".event-tooltip"
        );


    if (eventTooltip) {

        eventTooltip.remove();

    }

}


// =====================================================
// Canvas 清空
// =====================================================

function clearCanvas(
    canvas
) {

    const ctx =
        canvas.getContext("2d");


    const rect =
        canvas.getBoundingClientRect();


    const width =
        Math.max(300, Math.floor(rect.width));

    const height =
        Math.max(220, Math.floor(rect.height));

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width = width * dpr;
    canvas.height = height * dpr;


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

    removeTrendTooltip(canvas);

}


// =====================================================
// 日期标签数量
// =====================================================

function getChartLabelIndexes(
    length
) {

    if (length <= 6) {

        return Array.from(
            { length },
            function (_, index) {
                return index;
            }
        );

    }


    const maxLabels = 6;
    const indexes = [];


    for (
        let i = 0;
        i < maxLabels;
        i++
    ) {

        indexes.push(
            Math.round(
                i * (length - 1) / (maxLabels - 1)
            )
        );

    }


    return [
        ...new Set(indexes)
    ];

}


// =====================================================
// 趋势图 Y 轴格式
// =====================================================

function formatChartAxisValue(
    value,
    format
) {

    if (format === "money") {

        const n =
            toNumber(value);

        if (Math.abs(n) >= 1000) {
            return "$" +
                (n / 1000).toFixed(1) +
                "k";
        }

        return "$" +
            n.toFixed(0);

    }


    if (format === "percent") {
        return toNumber(value).toFixed(1) + "%";
    }


    const n =
        toNumber(value);


    if (Math.abs(n) >= 1000000) {
        return (n / 1000000).toFixed(1) + "m";
    }


    if (Math.abs(n) >= 1000) {
        return (n / 1000).toFixed(1) + "k";
    }


    return n.toFixed(0);

}


// =====================================================
// 趋势图日期显示
// =====================================================

function formatShortDate(
    dateString
) {

    const date =
        parseLocalDate(
            dateString
        );


    return (
        String(
            date.getMonth() + 1
        ) +
        "/" +
        String(
            date.getDate()
        )
    );

}


// =====================================================
// 浏览器窗口变化时重绘
// =====================================================

window.addEventListener(
    "resize",
    function () {

        renderAllTrendCharts(
            filteredShopData.length > 0
                ? filteredShopData
                : allShopData
        );

    }
);


// =====================================================
// V4 上传预览 / 结果 / 历史
// =====================================================

function renderUploadPreview(files){

    const box =
        document.getElementById("uploadPreview");

    const content =
        document.getElementById("uploadPreviewContent");


    if(!box || !content){
        return;
    }


    box.style.display = "block";


    content.innerHTML =
        files.map(
            file =>
            `
            <div class="shop-upload-list-item">
                📄 ${file.name}
            </div>
            `
        ).join("");

}



function renderUploadResult(
    insertCount,
    updateCount,
    failCount
){

    const box =
        document.getElementById("uploadResult");

    const content =
        document.getElementById("uploadResultContent");


    if(!box || !content){
        return;
    }


    box.style.display = "block";


    content.innerHTML =
    `
    <div>新增：${insertCount} 天</div>
    <div>更新：${updateCount} 天</div>
    <div>失败：${failCount} 个文件</div>
    `;

}



function saveUploadHistory(
    files,
    insertCount,
    updateCount,
    failCount
){

    uploadHistory.unshift({

        time:
            new Date().toLocaleString(),

        files,
        insertCount,
        updateCount,
        failCount

    });


    uploadHistory =
        uploadHistory.slice(0,10);


    localStorage.setItem(
        "shopUploadHistory",
        JSON.stringify(uploadHistory)
    );


    renderUploadHistory();

}



function renderUploadHistory(){

    const box =
        document.getElementById("uploadHistory");

    const content =
        document.getElementById("uploadHistoryContent");


    if(!box || !content){
        return;
    }


    if(uploadHistory.length === 0){
        return;
    }


    box.style.display = "block";


    content.innerHTML =
        uploadHistory.map(
            item =>
            `
            <div class="shop-upload-list-item">
                ${item.time}
                <br>
                文件：${item.files}
                个
                <br>
                新增 ${item.insertCount}
                / 更新 ${item.updateCount}
                / 失败 ${item.failCount}
            </div>
            `
        ).join("");

}


console.log(
    "shop-data.js 加载完成"
);


// ===============================
// Supabase 运营事件
// ===============================

async function loadShopEvents(){

    const client = getSupabaseClient();

    if(!client){
        console.error("Supabase Client 不存在");
        return;
    }

    const {
        data,
        error
    } = await client
        .from("shop_events")
        .select("*")
        .order("date",{
            ascending:false
        });

    if(error){
        console.error("读取运营事件失败",error);
        return;
    }

    shopEvents = data || [];

}


// ===============================
// 运营事件功能
// ===============================


function bindEventEvents(){



const addBtn =
document.getElementById(
"addEventBtn"
);


const modal =
document.getElementById(
"eventModal"
);



if(addBtn){

addBtn.onclick=function(){

modal.style.display="flex";

};

}



const closeBtn =
document.getElementById(
"closeEventBtn"
);


if(closeBtn){

closeBtn.onclick=function(){

modal.style.display="none";

};

}


// ===============================
// 运营事件管理弹窗
// ===============================

const manageBtn =
document.getElementById(
    "manageEventBtn"
);

const manageModal =
document.getElementById(
    "eventManageModal"
);

const closeManageBtn =
document.getElementById(
    "closeManageEventBtn"
);

if(manageBtn){

    manageBtn.onclick=function(){

        if(manageModal){

            manageModal.style.display="flex";

            renderEventManager();

        }

    };

}

if(closeManageBtn){

    closeManageBtn.onclick=function(){

        if(manageModal){

            manageModal.style.display="none";

        }

    };

}

const eventSearch =
document.getElementById(
    "eventSearch"
);

const eventFilter =
document.getElementById(
    "eventFilter"
);

if(eventSearch){

    eventSearch.addEventListener(
        "input",
        renderEventManager
    );

}

if(eventFilter){

    eventFilter.addEventListener(
        "change",
        renderEventManager
    );

}



const saveBtn =
document.getElementById(
"saveEventBtn"
);

// ===============================
// 日期框点击打开日历
// ===============================

const eventDateInput =

document.getElementById(
    "eventDate"
);


if(eventDateInput){

    eventDateInput.addEventListener(
        "click",
        function(){

            if(this.showPicker){

                this.showPicker();

            }

        }
    );

}



if(saveBtn){

saveBtn.onclick=async function(){


const item={

id:
Date.now(),


date:
document.getElementById(
"eventDate"
).value,


impact:
document.getElementById(
"eventImpact"
).value,


type:
document.getElementById(
"eventType"
).value,


title:
document.getElementById(
"eventTitle"
).value,


description:
document.getElementById(
"eventDesc"
).value

};



const client = getSupabaseClient();

if(!client){
    alert("Supabase连接失败");
    return;
}

const {
    data,
    error
} = await client
    .from("shop_events")
    .insert({

        date:item.date,

        impact:item.impact,

        type:item.type,

        title:item.title,

        description:item.description

    })
    .select()
    .single();


if(error){

    console.error(error);

    alert("保存失败");

    return;

}


shopEvents.unshift(data);



modal.style.display="none";


showShopToast(
    "事件保存成功"
);


};


}


}

function drawEventStar(
    ctx,
    x,
    y,
    impact
){


    const outerRadius = 8;

    const innerRadius = 4;


    let rotation =
        Math.PI / 2 * 3;


    const step =
        Math.PI / 5;



    ctx.beginPath();


    ctx.moveTo(
        x,
        y - outerRadius
    );



    for(
        let i = 0;
        i < 5;
        i++
    ){


        ctx.lineTo(
            x +
            Math.cos(rotation) *
            outerRadius,

            y +
            Math.sin(rotation) *
            outerRadius
        );


        rotation += step;



        ctx.lineTo(
            x +
            Math.cos(rotation) *
            innerRadius,

            y +
            Math.sin(rotation) *
            innerRadius
        );


        rotation += step;


    }


    ctx.closePath();



    ctx.fillStyle =
        impact === "positive"
        ? "#22c55e"
        : "#ef4444";



    ctx.fill();

}

function showEventTooltip(
    canvas,
    eventItem,
    x,
    y
){


    removeTrendTooltip(canvas);



    let tooltip =
        document.createElement(
            "div"
        );


    tooltip.className =
        "trend-tooltip event-tooltip";



    const color =
        eventItem.impact === "positive"
        ? "#22c55e"
        : "#ef4444";



    tooltip.innerHTML = `


        <div style="
            font-weight:700;
            margin-bottom:8px;
            color:${color};
        ">

            ${
                eventItem.impact === "positive"
                ? "🟢 正面事件"
                : "🔴 负面事件"
            }

        </div>



        <div>
            日期：
            ${eventItem.date}
        </div>



        <div style="
            margin-top:6px;
            font-weight:600;
        ">

            ${eventItem.title}

        </div>



        <div style="
            margin-top:6px;
            color:#666;
        ">

            ${eventItem.description || ""}

        </div>


    `;



    document.body.appendChild(
        tooltip
    );



    const rect =
        canvas.getBoundingClientRect();



    tooltip.style.left =
        (
            rect.left +
            x +
            15
        )
        +
        "px";



    tooltip.style.top =
        (
            rect.top +
            y -
            20
        )
        +
        "px";



    canvas._eventTooltip =
        tooltip;

}

// ===============================
// 运营事件管理
// ===============================


function renderEventManager(){


    const list =
        document.getElementById(
            "eventList"
        );


    if(!list){
        return;
    }



    if(shopEvents.length === 0){

        list.innerHTML =
        `
        <div>
            暂无运营事件
        </div>
        `;

        return;

    }



    let listData =
        [...shopEvents];


    const keyword =
        (document.getElementById("eventSearch")?.value || "")
        .trim();

    const filter =
        document.getElementById("eventFilter")?.value || "all";


    if(keyword){

        listData = listData.filter(function(item){

            return (item.title || "").includes(keyword) ||
                   (item.description || "").includes(keyword);

        });

    }


    if(filter !== "all"){

        listData = listData.filter(function(item){

            return item.impact === filter;

        });

    }


    const sorted =
        listData.sort(
            function(a,b){

                return b.id - a.id;

            }
        );



    list.innerHTML =
        sorted.map(
            function(item,index){


                return `

                <div class="event-manager-item">


                    <div>


                        <div>
                            ${item.impact==="positive"
                            ?"🟢 正面"
                            :"🔴 负面"
                            }

                            ${item.date}

                        </div>


                        <strong>
                            ${item.title}
                        </strong>


                        <div>
                            ${item.type}
                        </div>


                        <small>
                            ${item.description || ""}
                        </small>


                    </div>



                    <button
                        onclick="
                        deleteShopEvent(${item.id})
                        "
                    >
                        删除
                    </button>


                </div>

                `;


            }
        )
        .join("");

}




let deleteEventId = null;



function deleteShopEvent(id){

    deleteEventId = id;


    const modal =
        document.getElementById(
            "confirmModal"
        );


    if(modal){

        modal.style.display = "flex";

    }

}





function bindConfirmDeleteEvent(){


    const cancelBtn =
        document.getElementById(
            "confirmCancelBtn"
        );


    const okBtn =
        document.getElementById(
            "confirmOkBtn"
        );



    if(cancelBtn){

        cancelBtn.onclick = function(){

            const modal =
                document.getElementById(
                    "confirmModal"
                );


            if(modal){

                modal.style.display = "none";

            }


            deleteEventId = null;

        };

    }



    if(okBtn){

        okBtn.onclick = async function(){


            if(deleteEventId === null){

                return;

            }



            const client = getSupabaseClient();

            if(client){

                const {
                    error
                } = await client
                    .from("shop_events")
                    .delete()
                    .eq(
                        "id",
                        deleteEventId
                    );

                if(error){

                    console.error(error);

                    alert("删除失败");

                    return;

                }

            }


            shopEvents =
                shopEvents.filter(
                    function(item){

                        return item.id !== deleteEventId;

                    }
                );



            const modal =
                document.getElementById(
                    "confirmModal"
                );


            if(modal){

                modal.style.display = "none";

            }



            renderEventManager();



            renderAllTrendCharts(
                filteredShopData
            );



            deleteEventId = null;


        };

    }


}

// ===============================
// Toast提示
// ===============================


function showShopToast(message){


    let toast =
        document.querySelector(
            ".shop-toast"
        );



    if(!toast){


        toast =
            document.createElement(
                "div"
            );


        toast.className =
            "shop-toast";


        document.body.appendChild(
            toast
        );


    }



    toast.innerHTML =
        "✓ " + message;



    toast.classList.add(
        "show"
    );



    setTimeout(
        function(){


            toast.classList.remove(
                "show"
            );


        },
        2000
    );


}