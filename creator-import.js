// =====================================================
// creator-import.js
// 达人 Excel 批量导入
//
// v7
//
// 功能：
// 1. 自动解析：尺码 + 身高 + 体重
// 2. 自动清理：产品颜色 + 产品尺码
// 3. 自动识别产品主体
// 4. 支持通过同 SKU 的多个产品名称自动推断产品主体
// 5. 支持常见中文 / 英文颜色
// 6. 错误数据自动跳过
// 7. Excel 内自动检测重复
// 8. Supabase 自动检测重复
// 9. 重复判断：达人 + 产品 + 推荐尺码
// =====================================================

console.log("================================");
console.log("creator-import.js 已成功加载");
console.log("版本：v7");
console.log("================================");


// =====================================================
// 全局数据
// =====================================================

let importData = [];


// =====================================================
// 检查 Supabase
// =====================================================

function checkSupabase() {

    if (
        typeof supabaseClient === "undefined" ||
        !supabaseClient
    ) {

        console.error(
            "supabaseClient 不存在"
        );

        alert(
            "Supabase 连接失败，请刷新页面"
        );

        return false;
    }

    return true;
}


// =====================================================
// HTML 安全处理
// =====================================================

function escapeHTML(value) {

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
// 产品颜色词
//
// 注意：
// 这里不仅放完整颜色
// 也放一些你目前产品实际使用的颜色简称
//
// 例如：
// 麻
// 雨林
// 午夜
// 花
// 绯
//
// 这些会被作为产品名称最后面的颜色后缀处理
// =====================================================

const PRODUCT_COLOR_WORDS = [

    // -----------------------------
    // 中文完整颜色
    // -----------------------------

    "浅蓝色",
    "深蓝色",
    "浅灰色",
    "深灰色",
    "浅绿色",
    "深绿色",
    "浅棕色",
    "深棕色",

    "浅咖色",
    "深咖色",
    "浅卡其色",
    "深卡其色",

    "米白色",
    "奶白色",
    "奶油色",
    "象牙白",
    "米色",
    "卡其色",

    "天蓝色",
    "湖蓝色",
    "藏蓝色",
    "宝蓝色",
    "墨蓝色",

    "军绿色",
    "橄榄绿",
    "墨绿色",
    "草绿色",

    "酒红色",
    "玫红色",
    "粉红色",
    "浅粉色",
    "深粉色",

    "咖啡色",
    "棕色",
    "褐色",

    "紫色",
    "灰色",
    "黑色",
    "白色",
    "红色",
    "黄色",
    "绿色",
    "蓝色",
    "橙色",
    "粉色",

    "黑",
    "白",
    "灰",
    "红",
    "黄",
    "绿",
    "蓝",
    "紫",
    "粉",
    "棕",
    "卡其",
    "咖色",

    // -----------------------------
    // 你目前实际使用的颜色简称
    // -----------------------------

    "麻",
    "麻灰",
    "麻灰色",

    "雨林",
    "雨林绿",

    "午夜",
    "午夜黑",
    "午夜蓝",

    "花",
    "绯",

    // -----------------------------
    // 英文颜色
    // -----------------------------

    "Black",
    "White",
    "Grey",
    "Gray",
    "Red",
    "Blue",
    "Navy",
    "Green",
    "Pink",
    "Purple",
    "Brown",
    "Beige",
    "Khaki",
    "Cream",
    "Ivory",

    "Navy Blue",
    "Light Blue",
    "Dark Blue",
    "Light Gray",
    "Dark Gray",

    "Off White",
    "Off-White",

    "Vintage Black",
    "Washed Black",
    "Washed Gray",
    "Charcoal",

    "Olive",
    "Forest Green",
    "Sage",
    "Burgundy",
    "Wine Red",

    "Tan",
    "Mocha",
    "Coffee",

    "Stone",
    "Sand",

    "Cream White",
    "Natural",

    "Chocolate",
    "Rust",

    "Heather Gray",
    "Heather Grey"
];


// =====================================================
// 产品颜色排序
//
// 长颜色必须优先
//
// 例如：
// 浅蓝色
// 必须在
// 蓝
// 前面
// =====================================================

const SORTED_COLOR_WORDS =
    PRODUCT_COLOR_WORDS
        .slice()
        .sort(
            function(a, b) {

                return b.length - a.length;
            }
        );


// =====================================================
// 产品尺码清理
// =====================================================

function removeProductSize(product) {

    if (!product) {

        return "";
    }

    let result =
        String(product).trim();


    const sizeRegex =
        /\s*(XXXL|XXL|XL|XS|XXS|3XL|2XL|3X|2X|S|M|L)\s*$/i;


    result =
        result.replace(
            sizeRegex,
            ""
        );


    return result.trim();
}


// =====================================================
// 清理末尾颜色
// =====================================================

function removeEndingColor(product) {

    if (!product) {

        return "";
    }

    let result =
        String(product).trim();


    let changed = true;


    while (changed) {

        changed = false;


        for (
            let i = 0;
            i < SORTED_COLOR_WORDS.length;
            i++
        ) {

            const color =
                SORTED_COLOR_WORDS[i];


            const escapedColor =
                color.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );


            const regex =
                new RegExp(
                    "\\s*" +
                    escapedColor +
                    "\\s*$",
                    "i"
                );


            if (
                regex.test(result)
            ) {

                result =
                    result
                        .replace(
                            regex,
                            ""
                        )
                        .trim();


                changed = true;

                break;
            }
        }
    }


    return result;
}


// =====================================================
// 根据 SKU 获取产品编号
//
// 例如：
//
// M100加绒运动裤
// M100-加绒运动裤
//
// 得到：
//
// M100
// =====================================================

function getProductSKU(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    const text =
        String(value).trim();


    const match =
        text.match(
            /^([A-Za-z]+\d+)/
        );


    if (!match) {

        return "";
    }


    return match[1]
        .toLowerCase();
}


// =====================================================
// 清理基础产品名称
//
// 处理逻辑：
//
// 1. 去空格
// 2. 去末尾尺码
// 3. 去末尾颜色
// 4. 再去一次尺码
// 5. 去末尾特殊符号
// =====================================================

function basicCleanProductName(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    let product =
        String(value)
            .trim()
            .replace(/\s+/g, " ");


    if (!product) {

        return "";
    }


    product =
        removeProductSize(
            product
        );


    product =
        removeEndingColor(
            product
        );


    product =
        removeProductSize(
            product
        );


    product =
        product
            .replace(
                /[\s\-_]+$/g,
                ""
            )
            .trim();


    return product;
}


// =====================================================
// 找到两个产品名称的共同主体
//
// 这个函数主要用于：
//
// M100加绒运动裤运动长裤直筒裤雨林
// M100加绒运动裤运动长裤直筒裤午夜
//
// 自动找到：
//
// M100加绒运动裤运动长裤直筒裤
//
// =====================================================

function findCommonProductBase(
    productA,
    productB
) {

    if (
        !productA ||
        !productB
    ) {

        return "";
    }


    const a =
        String(productA).trim();


    const b =
        String(productB).trim();


    if (!a || !b) {

        return "";
    }


    const minLength =
        Math.min(
            a.length,
            b.length
        );


    let commonLength = 0;


    for (
        let i = 0;
        i < minLength;
        i++
    ) {

        if (
            a[i] !== b[i]
        ) {

            break;
        }


        commonLength++;
    }


    if (
        commonLength < 5
    ) {

        return "";
    }


    let common =
        a.substring(
            0,
            commonLength
        ).trim();


    common =
        common.replace(
            /[\s\-_]+$/g,
            ""
        ).trim();


    return common;
}


// =====================================================
// 从当前 Excel 数据中推断产品主体
//
// 例如当前 Excel 有：
//
// M100加绒运动裤运动长裤直筒裤雨林
// M100加绒运动裤运动长裤直筒裤午夜
// M100加绒运动裤运动长裤直筒裤花
//
// 自动推断：
//
// M100加绒运动裤运动长裤直筒裤
//
// 这样以后新增颜色时，
// 不需要你手动增加颜色词。
// =====================================================

function buildExcelProductBaseMap(rows, productIndex) {

    const skuGroups = {};


    if (
        !rows ||
        rows.length < 2
    ) {

        return skuGroups;
    }


    for (
        let i = 1;
        i < rows.length;
        i++
    ) {

        const row =
            rows[i];


        if (!row) {

            continue;
        }


        const original =
            String(
                row[productIndex] || ""
            ).trim();


        if (!original) {

            continue;
        }


        const sku =
            getProductSKU(
                original
            );


        if (!sku) {

            continue;
        }


        if (
            !skuGroups[sku]
        ) {

            skuGroups[sku] = [];
        }


        skuGroups[sku].push(
            original
        );
    }


    const baseMap = {};


    Object.keys(
        skuGroups
    ).forEach(
        function(sku) {

            const products =
                skuGroups[sku];


            if (
                products.length < 2
            ) {

                return;
            }


            let commonBase =
                products[0];


            for (
                let i = 1;
                i < products.length;
                i++
            ) {

                commonBase =
                    findCommonProductBase(
                        commonBase,
                        products[i]
                    );


                if (!commonBase) {

                    break;
                }
            }


            if (
                commonBase &&
                commonBase.length >= 5
            ) {

                baseMap[sku] =
                    basicCleanProductName(
                        commonBase
                    );
            }
        }
    );


    return baseMap;
}


// =====================================================
// 产品名称最终清理
//
// 第一层：固定颜色词
//
// 第二层：当前 Excel 同 SKU 自动推断
//
// 第三层：保留原始名称
//
// 这样即使以后新增产品颜色，
// 只要同一个 SKU 在 Excel 中出现过不同颜色，
// 就可以自动推断。
// =====================================================

function cleanProductName(
    value,
    inferredBaseMap
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    let original =
        String(value)
            .trim()
            .replace(/\s+/g, " ");


    if (!original) {

        return "";
    }


    const sku =
        getProductSKU(
            original
        );


    // =================================================
    // 如果当前 Excel 已经通过同 SKU 推断出了主体
    // 优先使用推断结果
    // =================================================

    if (
        sku &&
        inferredBaseMap &&
        inferredBaseMap[sku]
    ) {

        const inferredBase =
            inferredBaseMap[sku];


        if (
            original.startsWith(
                inferredBase
            )
        ) {

            return inferredBase;
        }
    }


    // =================================================
    // 常规清理
    // =================================================

    let product =
        basicCleanProductName(
            original
        );


    return product;
}


// =====================================================
// 下载模板
// =====================================================

function downloadTemplate() {

    console.log(
        "开始生成达人导入模板"
    );


    if (
        typeof XLSX === "undefined"
    ) {

        alert(
            "Excel组件没有加载成功，请刷新页面后重试"
        );


        console.error(
            "XLSX 不存在"
        );


        return;
    }


    const data = [

        [
            "达人Handle",
            "寄样尺码+身高体重",
            "产品",
            "视频链接"
        ],

        [
            "example_creator",
            "M(H5'10,W173lbs)",
            "M400美式高街复古松紧腰牛仔裤浅蓝色L",
            "https://www.tiktok.com/@example/video/123456"
        ]

    ];


    try {

        const worksheet =
            XLSX.utils.aoa_to_sheet(
                data
            );


        worksheet["!cols"] = [

            {
                wch: 25
            },

            {
                wch: 30
            },

            {
                wch: 40
            },

            {
                wch: 55
            }

        ];


        const workbook =
            XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "达人数据"
        );


        XLSX.writeFile(
            workbook,
            "达人数据导入模板.xlsx"
        );


        console.log(
            "模板下载成功"
        );

    }

    catch (error) {

        console.error(
            "模板生成失败:",
            error
        );


        alert(
            "模板下载失败，请打开浏览器控制台查看错误"
        );
    }
}


// =====================================================
// 解析尺码 + 身高 + 体重
// =====================================================

function parseSizeHeightWeight(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return {

            success: false,

            size: "",

            feet: 0,

            inch: 0,

            lbs: 0,

            heightCm: 0,

            weightKg: 0,

            original: "",

            error: "数据为空"
        };
    }


    const original =
        String(value).trim();


    if (!original) {

        return {

            success: false,

            size: "",

            feet: 0,

            inch: 0,

            lbs: 0,

            heightCm: 0,

            weightKg: 0,

            original: "",

            error: "数据为空"
        };
    }


    const text =
        original
            .replace(/\s+/g, " ")
            .trim();


    // =================================================
    // 推荐尺码
    // =================================================

    const sizeMatch =
        text.match(
            /^([A-Za-z0-9+\/-]+)\s*\(/i
        );


    if (!sizeMatch) {

        return {

            success: false,

            size: "",

            feet: 0,

            inch: 0,

            lbs: 0,

            heightCm: 0,

            weightKg: 0,

            original: original,

            error: "无法识别推荐尺码"
        };
    }


    const size =
        sizeMatch[1].trim();


    // =================================================
    // 身高
    // =================================================

    const heightMatch =
        text.match(
            /H\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?/i
        );


    if (!heightMatch) {

        return {

            success: false,

            size: size,

            feet: 0,

            inch: 0,

            lbs: 0,

            heightCm: 0,

            weightKg: 0,

            original: original,

            error: "无法识别身高"
        };
    }


    const feet =
        Number(
            heightMatch[1]
        );


    const inch =
        Number(
            heightMatch[2]
        );


    // =================================================
    // 体重
    // =================================================

    const weightMatch =
        text.match(
            /W\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)?/i
        );


    if (!weightMatch) {

        return {

            success: false,

            size: size,

            feet: feet,

            inch: inch,

            lbs: 0,

            heightCm: 0,

            weightKg: 0,

            original: original,

            error: "无法识别体重"
        };
    }


    const lbs =
        Number(
            weightMatch[1]
        );


    // =================================================
    // 身高检查
    // =================================================

    if (
        feet <= 0 ||
        inch < 0 ||
        inch >= 12
    ) {

        return {

            success: false,

            size: size,

            feet: feet,

            inch: inch,

            lbs: lbs,

            heightCm: 0,

            weightKg: 0,

            original: original,

            error: "身高数据异常"
        };
    }


    // =================================================
    // 体重检查
    // =================================================

    if (
        lbs <= 0
    ) {

        return {

            success: false,

            size: size,

            feet: feet,

            inch: inch,

            lbs: lbs,

            heightCm: 0,

            weightKg: 0,

            original: original,

            error: "体重数据异常"
        };
    }


    // =================================================
    // Feet / Inch → cm
    // =================================================

    const heightCm =
        Number(
            (
                feet * 30.48 +
                inch * 2.54
            ).toFixed(1)
        );


    // =================================================
    // lbs → kg
    // =================================================

    const weightKg =
        Number(
            (
                lbs * 0.453592
            ).toFixed(1)
        );


    return {

        success: true,

        size: size,

        feet: feet,

        inch: inch,

        lbs: lbs,

        heightCm: heightCm,

        weightKg: weightKg,

        original: original,

        error: ""
    };
}


// =====================================================
// 找到 Excel 列
// =====================================================

function findColumn(
    headers,
    names
) {

    for (
        let i = 0;
        i < headers.length;
        i++
    ) {

        const header =
            String(
                headers[i] || ""
            )
                .trim()
                .toLowerCase();


        for (
            let j = 0;
            j < names.length;
            j++
        ) {

            const name =
                String(
                    names[j] || ""
                )
                    .trim()
                    .toLowerCase();


            if (
                header === name
            ) {

                return i;
            }
        }
    }


    return -1;
}


// =====================================================
// 生成唯一匹配 Key
// =====================================================

function createDuplicateKey(
    handle,
    product,
    size
) {

    return [

        String(
            handle || ""
        )
            .trim()
            .toLowerCase(),

        String(
            product || ""
        )
            .trim()
            .toLowerCase(),

        String(
            size || ""
        )
            .trim()
            .toLowerCase()

    ].join("|||");
}


// =====================================================
// 上传 Excel
// =====================================================

function handleExcelUpload(event) {

    const file =
        event.target.files &&
        event.target.files[0];


    if (!file) {

        return;
    }


    console.log(
        "选择文件:",
        file.name
    );


    const fileInfo =
        document.getElementById(
            "fileInfo"
        );


    if (fileInfo) {

        fileInfo.innerHTML =
            "已选择：<strong>" +
            escapeHTML(
                file.name
            ) +
            "</strong>";
    }


    if (
        typeof XLSX === "undefined"
    ) {

        alert(
            "Excel组件没有加载成功，请刷新页面"
        );


        console.error(
            "XLSX 不存在"
        );


        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function(e) {

            try {

                const data =
                    new Uint8Array(
                        e.target.result
                    );


                const workbook =
                    XLSX.read(
                        data,
                        {
                            type: "array"
                        }
                    );


                if (
                    !workbook.SheetNames ||
                    workbook.SheetNames.length === 0
                ) {

                    alert(
                        "Excel 中没有工作表"
                    );

                    return;
                }


                const firstSheet =
                    workbook.Sheets[
                        workbook.SheetNames[0]
                    ];


                const rows =
                    XLSX.utils.sheet_to_json(
                        firstSheet,
                        {
                            header: 1,
                            defval: "",
                            raw: false
                        }
                    );


                if (
                    !rows ||
                    rows.length < 2
                ) {

                    alert(
                        "Excel 中没有有效数据"
                    );

                    return;
                }


                parseExcelRows(
                    rows
                );

            }

            catch(error) {

                console.error(
                    "Excel读取失败:",
                    error
                );


                alert(
                    "Excel读取失败，请检查文件格式"
                );
            }
        };


    reader.onerror =
        function() {

            console.error(
                "FileReader读取失败"
            );


            alert(
                "文件读取失败，请重新选择 Excel"
            );
        };


    reader.readAsArrayBuffer(
        file
    );
}


// =====================================================
// 解析 Excel 数据
// =====================================================

function parseExcelRows(rows) {

    console.log(
        "Excel原始数据:",
        rows
    );


    if (
        !rows ||
        rows.length === 0
    ) {

        alert(
            "Excel 中没有数据"
        );

        return;
    }


    const headers =
        rows[0].map(
            function(item) {

                return String(
                    item || ""
                ).trim();
            }
        );


    console.log(
        "Excel表头:",
        headers
    );


    // =================================================
    // 找字段
    // =================================================

    const handleIndex =
        findColumn(
            headers,
            [
                "达人Handle",
                "Handle",
                "达人 handle",
                "达人 Handle",
                "Creator Handle",
                "CreatorHandle"
            ]
        );


    const sizeHeightIndex =
        findColumn(
            headers,
            [
                "寄样尺码+身高体重",
                "寄样尺码身高体重",
                "尺码+身高体重",
                "寄样尺码",
                "Sample Size + Height + Weight",
                "Size + Height + Weight"
            ]
        );


    const productIndex =
        findColumn(
            headers,
            [
                "产品",
                "Product",
                "product",
                "产品名称",
                "Product Name"
            ]
        );


    const videoIndex =
        findColumn(
            headers,
            [
                "视频链接",
                "TikTok视频链接",
                "Video",
                "Video URL",
                "Video Link",
                "视频"
            ]
        );


    console.log(
        "字段位置:",
        {
            handleIndex,
            sizeHeightIndex,
            productIndex,
            videoIndex
        }
    );


    // =================================================
    // 检查表头
    // =================================================

    const missing = [];


    if (
        handleIndex === -1
    ) {

        missing.push(
            "达人Handle"
        );
    }


    if (
        sizeHeightIndex === -1
    ) {

        missing.push(
            "寄样尺码+身高体重"
        );
    }


    if (
        productIndex === -1
    ) {

        missing.push(
            "产品"
        );
    }


    if (
        videoIndex === -1
    ) {

        missing.push(
            "视频链接"
        );
    }


    if (
        missing.length > 0
    ) {

        console.error(
            "Excel实际表头:",
            headers
        );


        alert(
            "Excel 缺少以下字段：\n\n" +
            missing.join("\n") +
            "\n\n当前识别到的表头：\n" +
            headers.join(" | ")
        );


        return;
    }


    // =================================================
    // 建立当前 Excel 的 SKU 产品主体推断
    // =================================================

    const inferredBaseMap =
        buildExcelProductBaseMap(
            rows,
            productIndex
        );


    console.log(
        "当前 Excel 自动推断出的产品主体:",
        inferredBaseMap
    );


    // =================================================
    // 清空旧数据
    // =================================================

    importData = [];


    // =================================================
    // Excel 内部重复 Key
    // =================================================

    const excelKeys =
        new Set();


    // =================================================
    // 逐行读取
    // =================================================

    for (
        let i = 1;
        i < rows.length;
        i++
    ) {

        const row =
            rows[i];


        if (!row) {

            continue;
        }


        const handle =
            String(
                row[handleIndex] || ""
            ).trim();


        const sizeHeight =
            String(
                row[sizeHeightIndex] || ""
            ).trim();


        const originalProduct =
            String(
                row[productIndex] || ""
            ).trim();


        const video =
            String(
                row[videoIndex] || ""
            ).trim();


        // =================================================
        // 空行跳过
        // =================================================

        if (
            !handle &&
            !sizeHeight &&
            !originalProduct &&
            !video
        ) {

            continue;
        }


        // =================================================
        // 产品自动清理
        // =================================================

        const product =
            cleanProductName(
                originalProduct,
                inferredBaseMap
            );


        // =================================================
        // 解析尺码身高体重
        // =================================================

        const parsed =
            parseSizeHeightWeight(
                sizeHeight
            );


        let error = "";


        if (!handle) {

            error =
                "缺少达人Handle";

        }

        else if (!product) {

            error =
                "缺少产品";

        }

        else if (!parsed.success) {

            error =
                parsed.error ||
                "尺码身高体重无法识别";
        }


        // =================================================
        // 错误数据仍然显示
        // =================================================

        if (error) {

            importData.push({

                rowNumber:
                    i + 1,

                handle:
                    handle,

                original:
                    sizeHeight,

                size:
                    parsed.size,

                feet:
                    parsed.feet,

                inch:
                    parsed.inch,

                lbs:
                    parsed.lbs,

                heightCm:
                    parsed.heightCm,

                weightKg:
                    parsed.weightKg,

                originalProduct:
                    originalProduct,

                product:
                    product,

                video:
                    video,

                success:
                    false,

                duplicate:
                    false,

                error:
                    error
            });


            continue;
        }


        // =================================================
        // 生成重复 Key
        // =================================================

        const duplicateKey =
            createDuplicateKey(
                handle,
                product,
                parsed.size
            );


        // =================================================
        // Excel 内部重复
        // =================================================

        if (
            excelKeys.has(
                duplicateKey
            )
        ) {

            importData.push({

                rowNumber:
                    i + 1,

                handle:
                    handle,

                original:
                    sizeHeight,

                size:
                    parsed.size,

                feet:
                    parsed.feet,

                inch:
                    parsed.inch,

                lbs:
                    parsed.lbs,

                heightCm:
                    parsed.heightCm,

                weightKg:
                    parsed.weightKg,

                originalProduct:
                    originalProduct,

                product:
                    product,

                video:
                    video,

                success:
                    false,

                duplicate:
                    true,

                error:
                    "Excel内重复，已自动跳过"
            });


            continue;
        }


        excelKeys.add(
            duplicateKey
        );


        // =================================================
        // 正常数据
        // =================================================

        importData.push({

            rowNumber:
                i + 1,

            handle:
                handle,

            original:
                sizeHeight,

            size:
                parsed.size,

            feet:
                parsed.feet,

            inch:
                parsed.inch,

            lbs:
                parsed.lbs,

            heightCm:
                parsed.heightCm,

            weightKg:
                parsed.weightKg,

            originalProduct:
                originalProduct,

            product:
                product,

            video:
                video,

            success:
                true,

            duplicate:
                false,

            error:
                ""
        });
    }


    console.log(
        "Excel解析完成:",
        importData
    );


    // =================================================
    // 检查 Supabase 已有数据
    // =================================================

    checkExistingCreators();
}


// =====================================================
// 检查 Supabase 中已经存在的数据
// =====================================================

async function checkExistingCreators() {

    if (
        !checkSupabase()
    ) {

        return;
    }


    const validItems =
        importData.filter(
            function(item) {

                return item.success === true;
            }
        );


    if (
        validItems.length === 0
    ) {

        renderPreview();

        return;
    }


    console.log(
        "开始检查 Supabase 重复数据"
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from("creators")
            .select(
                "id, handle, product, size"
            );


    if (error) {

        console.error(
            "读取已有达人数据失败:",
            error
        );


        renderPreview();

        return;
    }


    const existingKeys =
        new Set();


    if (
        data &&
        data.length > 0
    ) {

        data.forEach(
            function(item) {

                const cleanedProduct =
                    cleanProductName(
                        item.product
                    );


                const key =
                    createDuplicateKey(
                        item.handle,
                        cleanedProduct,
                        item.size
                    );


                existingKeys.add(
                    key
                );
            }
        );
    }


    // =================================================
    // 和数据库匹配
    // =================================================

    importData.forEach(
        function(item) {

            if (
                !item.success
            ) {

                return;
            }


            const key =
                createDuplicateKey(
                    item.handle,
                    item.product,
                    item.size
                );


            if (
                existingKeys.has(key)
            ) {

                item.success =
                    false;

                item.duplicate =
                    true;

                item.error =
                    "数据库已有相同达人、产品和尺码，已自动跳过";
            }
        }
    );


    console.log(
        "Supabase重复检查完成:",
        importData
    );


    renderPreview();
}


// =====================================================
// 渲染预览
// =====================================================

function renderPreview() {

    const body =
        document.getElementById(
            "previewBody"
        );


    const wrapper =
        document.getElementById(
            "previewWrapper"
        );


    const importBtn =
        document.getElementById(
            "importBtn"
        );


    const result =
        document.getElementById(
            "importResult"
        );


    if (!body) {

        console.error(
            "previewBody 不存在"
        );

        return;
    }


    body.innerHTML = "";


    if (
        importData.length === 0
    ) {

        if (wrapper) {

            wrapper.style.display =
                "none";
        }


        if (importBtn) {

            importBtn.style.display =
                "none";
        }


        return;
    }


    let successCount = 0;

    let errorCount = 0;

    let duplicateCount = 0;


    importData.forEach(
        function(item) {

            if (
                item.success
            ) {

                successCount++;

            }

            else {

                errorCount++;


                if (
                    item.duplicate
                ) {

                    duplicateCount++;
                }
            }


            const tr =
                document.createElement(
                    "tr"
                );


            let statusHTML = "";


            if (
                item.success
            ) {

                statusHTML = `

                    <span
                        style="
                            color:#00a870;
                            font-weight:600;
                        "
                    >
                        ✓ 可导入
                    </span>

                `;

            }

            else if (
                item.duplicate
            ) {

                statusHTML = `

                    <span
                        style="
                            color:#ff7d00;
                            font-weight:600;
                        "
                        title="${escapeHTML(
                            item.error
                        )}"
                    >
                        ⚠ ${escapeHTML(
                            item.error
                        )}
                    </span>

                `;

            }

            else {

                statusHTML = `

                    <span
                        style="
                            color:#f53f3f;
                            font-weight:600;
                        "
                        title="${escapeHTML(
                            item.error
                        )}"
                    >
                        ✕ ${escapeHTML(
                            item.error
                        )}
                    </span>

                `;
            }


            tr.innerHTML = `

                <td>
                    ${escapeHTML(
                        item.handle
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.original
                    )}
                </td>

                <td>
                    ${
                        item.size
                            ? escapeHTML(
                                item.size
                            )
                            : "--"
                    }
                </td>

                <td>
                    ${
                        item.heightCm
                            ? `${item.heightCm} cm`
                            : "--"
                    }
                </td>

                <td>
                    ${
                        item.weightKg
                            ? `${item.weightKg} kg`
                            : "--"
                    }
                </td>

                <td>
                    ${escapeHTML(
                        item.product
                    )}
                </td>

                <td>
                    ${
                        item.video
                            ? `
                                <a
                                    href="${escapeHTML(
                                        item.video
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style="
                                        color:#1677ff;
                                        text-decoration:none;
                                    "
                                >
                                    查看视频
                                </a>
                            `
                            : "--"
                    }
                </td>

                <td>
                    ${statusHTML}
                </td>

            `;


            body.appendChild(
                tr
            );
        }
    );


    if (wrapper) {

        wrapper.style.display =
            "block";
    }


    // =================================================
    // 结果统计
    // =================================================

    if (result) {

        result.innerHTML = `

            共读取

            <strong>
                ${importData.length}
            </strong>

            条数据，

            <span
                style="
                    color:#00a870;
                    font-weight:600;
                "
            >
                ${successCount}
                条可导入
            </span>

            ，

            <span
                style="
                    color:#f53f3f;
                    font-weight:600;
                "
            >
                ${errorCount}
                条被跳过
            </span>

            ${
                duplicateCount > 0
                    ? `
                        ，其中
                        <span
                            style="
                                color:#ff7d00;
                                font-weight:600;
                            "
                        >
                            ${duplicateCount}
                            条重复数据
                        </span>
                    `
                    : ""
            }

        `;
    }


    // =================================================
    // 导入按钮
    // =================================================

    if (importBtn) {

        if (
            successCount > 0
        ) {

            importBtn.style.display =
                "block";

            importBtn.disabled =
                false;

            importBtn.innerText =
                `✅ 确认导入 ${successCount} 条达人数据`;

        }

        else {

            importBtn.style.display =
                "none";
        }
    }
}


// =====================================================
// 导入 Supabase
// =====================================================

async function importCreators() {

    console.log(
        "开始导入达人数据"
    );


    if (
        !checkSupabase()
    ) {

        return;
    }


    // =================================================
    // 只拿正常数据
    // =================================================

    const validItems =
        importData.filter(
            function(item) {

                return item.success === true;
            }
        );


    if (
        validItems.length === 0
    ) {

        alert(
            "没有可以导入的数据"
        );

        return;
    }


    const importBtn =
        document.getElementById(
            "importBtn"
        );


    if (importBtn) {

        importBtn.disabled =
            true;

        importBtn.innerText =
            "⏳ 正在导入，请稍候...";
    }


    // =================================================
    // 转换成 Supabase 数据
    // =================================================

    const records =
        validItems.map(
            function(item) {

                return {

                    handle:
                        item.handle,

                    product:
                        item.product,

                    height_ft:
                        item.feet,

                    height_in:
                        item.inch,

                    weight_lbs:
                        item.lbs,

                    height_cm:
                        item.heightCm,

                    weight_kg:
                        item.weightKg,

                    size:
                        item.size,

                    fit:
                        "",

                    video_url:
                        item.video
                };
            }
        );


    console.log(
        "准备写入 Supabase:",
        records
    );


    // =================================================
    // 最后一次重复检查
    // =================================================

    const {
        data: existingData,
        error: existingError
    } =
        await supabaseClient
            .from("creators")
            .select(
                "id, handle, product, size"
            );


    if (existingError) {

        console.error(
            "重复检查失败:",
            existingError
        );


        if (importBtn) {

            importBtn.disabled =
                false;

            importBtn.innerText =
                "❌ 检查失败，请重试";
        }


        alert(
            "读取已有达人数据失败：" +
            existingError.message
        );


        return;
    }


    const existingKeys =
        new Set();


    if (
        existingData &&
        existingData.length > 0
    ) {

        existingData.forEach(
            function(item) {

                existingKeys.add(
                    createDuplicateKey(
                        item.handle,
                        cleanProductName(
                            item.product
                        ),
                        item.size
                    )
                );
            }
        );
    }


    // =================================================
    // 最后过滤
    // =================================================

    const finalRecords = [];


    records.forEach(
        function(record) {

            const key =
                createDuplicateKey(
                    record.handle,
                    record.product,
                    record.size
                );


            if (
                !existingKeys.has(key)
            ) {

                finalRecords.push(
                    record
                );


                existingKeys.add(
                    key
                );
            }
        }
    );


    // =================================================
    // 没有新数据
    // =================================================

    if (
        finalRecords.length === 0
    ) {

        if (importBtn) {

            importBtn.innerText =
                "⚠️ 没有新的达人数据";

            importBtn.disabled =
                true;
        }


        const finalResultText =
            document.getElementById(
                "finalResultText"
            );


        if (finalResultText) {

            finalResultText.innerHTML = `

                <span
                    style="
                        color:#ff7d00;
                        font-weight:600;
                    "
                >
                    ⚠️ 没有新的达人数据需要导入
                </span>

                <br>

                Excel 中的数据都已经存在，
                或者属于重复数据。

            `;
        }


        return;
    }


    // =================================================
    // 批量写入
    // =================================================

    const {
        data,
        error
    } =
        await supabaseClient
            .from("creators")
            .insert(
                finalRecords
            )
            .select();


    // =================================================
    // 导入失败
    // =================================================

    if (error) {

        console.error(
            "批量导入失败:",
            error
        );


        if (importBtn) {

            importBtn.disabled =
                false;

            importBtn.innerText =
                "❌ 导入失败，请重试";
        }


        const finalResult =
            document.getElementById(
                "finalResultText"
            );


        if (finalResult) {

            finalResult.innerHTML = `

                <span
                    style="
                        color:#f53f3f;
                        font-weight:600;
                    "
                >
                    ❌ 导入失败
                </span>

                <br>

                <span
                    style="
                        color:#86909c;
                        font-size:13px;
                    "
                >
                    ${escapeHTML(
                        error.message
                    )}
                </span>

            `;
        }


        return;
    }


    // =================================================
    // 导入成功
    // =================================================

    console.log(
        "批量导入成功:",
        data
    );


    const finalResult =
        document.getElementById(
            "finalResultText"
        );


    const skippedCount =
        importData.length -
        finalRecords.length;


    if (finalResult) {

        finalResult.innerHTML = `

            <span
                style="
                    color:#00a870;
                    font-weight:600;
                "
            >
                ✅ 达人数据导入成功
            </span>

            <br>

            成功导入

            <strong>
                ${finalRecords.length}
            </strong>

            条达人数据

            ${
                skippedCount > 0
                    ? `
                        <br>

                        <span
                            style="
                                color:#86909c;
                                font-size:13px;
                            "
                        >
                            自动跳过
                            ${skippedCount}
                            条错误或重复数据
                        </span>
                    `
                    : ""
            }

        `;
    }


    if (importBtn) {

        importBtn.innerText =
            `✅ 已成功导入 ${finalRecords.length} 条`;

        importBtn.disabled =
            true;
    }


    // =================================================
    // 清空当前导入数据
    // =================================================

    importData = [];
}


// =====================================================
// 页面加载
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "达人导入页面加载完成"
        );


        // =================================================
        // 下载模板按钮
        // =================================================

        const downloadBtn =
            document.getElementById(
                "downloadTemplateBtn"
            );


        if (downloadBtn) {

            downloadBtn.addEventListener(
                "click",
                downloadTemplate
            );


            console.log(
                "下载模板按钮绑定成功"
            );

        }

        else {

            console.error(
                "找不到 downloadTemplateBtn"
            );
        }


        // =================================================
        // Excel 文件
        // =================================================

        const fileInput =
            document.getElementById(
                "excelFile"
            );


        if (fileInput) {

            fileInput.addEventListener(
                "change",
                handleExcelUpload
            );


            console.log(
                "Excel上传按钮绑定成功"
            );

        }

        else {

            console.error(
                "找不到 excelFile"
            );
        }


        // =================================================
        // 导入按钮
        // =================================================

        const importBtn =
            document.getElementById(
                "importBtn"
            );


        if (importBtn) {

            importBtn.addEventListener(
                "click",
                importCreators
            );


            console.log(
                "导入按钮绑定成功"
            );

        }

        else {

            console.error(
                "找不到 importBtn"
            );
        }

    }
);


// =====================================================
// 暴露全局函数
// =====================================================

window.downloadTemplate =
    downloadTemplate;

window.handleExcelUpload =
    handleExcelUpload;

window.importCreators =
    importCreators;

window.parseSizeHeightWeight =
    parseSizeHeightWeight;

window.cleanProductName =
    cleanProductName;

console.log(
    "creator-import.js 所有函数加载完成"
);