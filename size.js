// =====================================================
// size.js
// 真人尺码参考
// 产品直接从 Supabase creators 表读取
// =====================================================

console.log("================================");
console.log("size.js 正在加载");
console.log("================================");


// =====================================================
// 全局数据
// =====================================================

let creatorLibrary = [];

window.creatorLibrary = [];

window.creatorsReady = null;

let currentProduct = "";


// =====================================================
// Supabase Client
// =====================================================

function getSupabaseClient() {

    if (
        window.supabaseClient
    ) {

        return window.supabaseClient;

    }

    return null;

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
// 产品名称处理
//
// 这里只负责显示统一
// 不修改 Supabase 原始数据
// =====================================================

function cleanProductName(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    let product =
        String(value)
            .replace(/\s+/g, " ")
            .trim();


    if (!product) {

        return "";

    }


    // =================================================
    // 去掉：
    //
    // - Black
    // - White
    // - Grey
    // - Gray
    // - Navy
    // - Blue
    // - Red
    // - Green
    // - Brown
    // - Beige
    // - Cream
    // - Khaki
    // - Tan
    // - Burgundy
    // - Wine
    // - Off White
    // - Charcoal
    // - Olive
    // =================================================

    const colors =
        "black|white|grey|gray|navy|blue|red|green|brown|beige|cream|khaki|tan|burgundy|wine|off\\s*white|charcoal|olive";


    const sizes =
        "XXXL|XXL|3XL|2XL|XL|XS|S|M|L";


    // =================================================
    // 颜色 + 尺码
    //
    // Baggy Pleated Shorts - Black - M
    // =================================================

    product =
        product.replace(

            new RegExp(
                "\\s*[-_/|]\\s*(?:" +
                colors +
                ")\\s*[-_/|]\\s*(?:" +
                sizes +
                ")\\s*$",
                "i"
            ),

            ""

        );


    // =================================================
    // 尺码
    //
    // Baggy Pleated Shorts - M
    // =================================================

    product =
        product.replace(

            new RegExp(
                "\\s*[-_/|]\\s*(?:" +
                sizes +
                ")\\s*$",
                "i"
            ),

            ""

        );


    // =================================================
    // 颜色
    //
    // Baggy Pleated Shorts - Black
    // =================================================

    product =
        product.replace(

            new RegExp(
                "\\s*[-_/|]\\s*(?:" +
                colors +
                ")\\s*$",
                "i"
            ),

            ""

        );


    // =================================================
    // 括号
    //
    // Baggy Pleated Shorts (Black)
    // Baggy Pleated Shorts (Black, M)
    // =================================================

    product =
        product.replace(

            /\s*\([^)]*\)\s*$/,

            ""

        );


    // =================================================
    // 清理末尾符号
    // =================================================

    product =
        product

            .replace(
                /\s*[-_/|]\s*$/,
                ""
            )

            .replace(
                /\s{2,}/g,
                " "
            )

            .trim();


    return product;

}


// =====================================================
// 等待 Supabase
// =====================================================

async function waitForSupabase() {

    for (
        let i = 0;
        i < 20;
        i++
    ) {

        const client =
            getSupabaseClient();


        if (client) {

            console.log(
                "✅ Supabase Client 已准备好"
            );

            return client;

        }


        console.log(
            "等待 Supabase:",
            i + 1
        );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );

    }


    console.error(
        "❌ Supabase Client 加载失败"
    );


    return null;

}


// =====================================================
// 第一步
// 直接从 creators 表读取所有产品
// =====================================================

async function loadProducts() {

    console.log("================================");
    console.log("📦 开始读取 Supabase 产品");
    console.log("================================");


    const client =
        await waitForSupabase();


    if (!client) {

        showNoProducts(
            "Supabase 连接失败"
        );

        return [];

    }


    // =================================================
    // 直接读取 product
    // =================================================

    const {
        data,
        error
    } = await client

        .from("creators")

        .select("product");


    // =================================================
    // 查询失败
    // =================================================

    if (error) {

        console.error(
            "❌ 产品读取失败:",
            error
        );


        showNoProducts(
            "产品读取失败"
        );


        return [];

    }


    console.log(
        "📦 Supabase 原始产品数据:",
        data
    );


    // =================================================
    // 提取产品
    // =================================================

    const products = [];


    data.forEach(
        item => {

            const product =
                cleanProductName(
                    item.product
                );


            if (
                product &&
                !products.includes(
                    product
                )
            ) {

                products.push(
                    product
                );

            }

        }
    );


    console.log(
        "================================"
    );

    console.log(
        "✅ 最终产品列表:",
        products
    );

    console.log(
        "产品数量:",
        products.length
    );

    console.log(
        "================================"
    );


    // =================================================
    // 生成产品下拉框
    // =================================================

    renderProductSelect(
        products
    );


    return products;

}


// =====================================================
// 产品下拉框
// =====================================================

function renderProductSelect(products) {

    const select =
        document.getElementById(
            "size-product"
        );


    if (!select) {

        console.error(
            "❌ 找不到 #size-product"
        );

        return;

    }


    // =================================================
    // 清空
    // =================================================

    select.innerHTML = "";


    // =================================================
    // 没有产品
    // =================================================

    if (
        !products ||
        products.length === 0
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value = "";


        option.textContent =
            "暂无产品数据";


        select.appendChild(
            option
        );


        currentProduct = "";


        return;

    }


    // =================================================
    // 默认选项
    // =================================================

    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value = "";


    defaultOption.textContent =
        "请选择产品";


    select.appendChild(
        defaultOption
    );


    // =================================================
    // 产品
    // =================================================

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


            select.appendChild(
                option
            );

        }
    );


    // =================================================
    // 产品变化
    // =================================================

    select.onchange =
        function() {

            currentProduct =
                cleanProductName(
                    this.value
                );


            console.log(
                "================================"
            );

            console.log(
                "👕 当前选择产品:",
                currentProduct
            );

            console.log(
                "================================"
            );


            renderCreators();


            const result =
                document.getElementById(
                    "result"
                );


            if (result) {

                result.innerHTML =
                    "请输入身高体重后查询";

            }

        };

}


// =====================================================
// 第二步
// 从 Supabase 读取完整达人数据
// =====================================================

async function loadCreators() {

    console.log("================================");
    console.log("👤 开始读取达人数据");
    console.log("================================");


    const client =
        await waitForSupabase();


    if (!client) {

        creatorLibrary = [];

        window.creatorLibrary = [];

        renderCreators();

        return [];

    }


    const {
        data,
        error
    } = await client

        .from("creators")

        .select("*");


    if (error) {

        console.error(
            "❌ 达人数据读取失败:",
            error
        );


        creatorLibrary = [];

        window.creatorLibrary = [];

        renderCreators();

        return [];

    }


    console.log(
        "✅ Supabase 达人原始数据:",
        data
    );


    if (
        !data ||
        data.length === 0
    ) {

        creatorLibrary = [];

        window.creatorLibrary = [];

        renderCreators();

        return [];

    }


    // =================================================
    // 转换
    // =================================================

    creatorLibrary =
        data.map(
            item => {

                return {

                    id:
                        item.id,

                    name:
                        String(
                            item.handle ?? ""
                        )
                        .trim(),

                    product:
                        cleanProductName(
                            item.product
                        ),

                    rawProduct:
                        String(
                            item.product ?? ""
                        )
                        .trim(),

                    height:
                        Number(
                            item.height_cm
                        ) || 0,

                    weight:
                        Number(
                            item.weight_kg
                        ) || 0,

                    size:
                        String(
                            item.size ?? ""
                        )
                        .trim(),

                    fit:
                        String(
                            item.fit ?? ""
                        )
                        .trim(),

                    video:
                        String(
                            item.video_url ?? ""
                        )
                        .trim()

                };

            }
        );


    window.creatorLibrary =
        creatorLibrary;


    console.log(
        "================================"
    );

    console.log(
        "✅ 达人数据加载完成"
    );

    console.log(
        "达人数量:",
        creatorLibrary.length
    );

    console.log(
        "================================"
    );


    // =================================================
    // 如果已经选择产品
    // 更新达人
    // =================================================

    renderCreators();


    return creatorLibrary;

}


// =====================================================
// 获取当前产品达人
// =====================================================

function getCurrentProductCreators() {

    const select =
        document.getElementById(
            "size-product"
        );


    if (select) {

        currentProduct =
            cleanProductName(
                select.value
            );

    }


    if (!currentProduct) {

        return [];

    }


    return creatorLibrary.filter(
        item => {

            return (
                cleanProductName(
                    item.product
                )
                ===
                currentProduct
            );

        }
    );

}


// =====================================================
// 显示达人
// =====================================================

function renderCreators() {

    const box =
        document.getElementById(
            "creatorList"
        );


    if (!box) {

        return;

    }


    box.innerHTML = "";


    const creators =
        getCurrentProductCreators();


    console.log(
        "👕 当前产品达人:",
        creators
    );


    // =================================================
    // 没有选择产品
    // =================================================

    if (!currentProduct) {

        box.innerHTML = `

            <div class="creator-empty">

                👕 请先选择产品

                <br>

                <span>
                    选择产品后即可查看相同产品的达人参考
                </span>

            </div>

        `;

        return;

    }


    // =================================================
    // 没有达人
    // =================================================

    if (
        creators.length === 0
    ) {

        box.innerHTML = `

            <div class="creator-empty">

                👕 暂时还没有该产品的达人数据

                <br>

                <span>
                    当前产品：
                    ${escapeHTML(
                        currentProduct
                    )}
                </span>

            </div>

        `;

        return;

    }


    // =================================================
    // 达人卡片
    // =================================================

    creators.forEach(
        item => {

            let videoButton = "";


            if (item.video) {

                videoButton = `

                    <button

                        type="button"

                        class="video-btn"

                        onclick="openVideo(${JSON.stringify(
                            item.video
                        )})"

                    >

                        🎬 查看达人视频

                    </button>

                `;

            }

            else {

                videoButton = `

                    <button

                        type="button"

                        class="
                            video-btn
                            video-disabled
                        "

                        disabled

                    >

                        暂无达人视频

                    </button>

                `;

            }


            box.innerHTML += `

                <div class="creator-card">


                    <div class="creator-top">


                        <div class="creator-avatar">

                            👕


                        </div>


                        <div class="creator-title">


                            <h3>

                                ${escapeHTML(
                                    item.name ||
                                    "未命名达人"
                                )}

                            </h3>


                            <div class="creator-product">

                                ${escapeHTML(
                                    item.product ||
                                    "暂无产品"
                                )}

                            </div>


                        </div>


                    </div>



                    <div class="creator-body">


                        <div class="creator-stat">


                            <span class="stat-label">

                                身高

                            </span>


                            <strong>

                                ${
                                    item.height ||
                                    "--"
                                }

                                cm

                            </strong>


                        </div>



                        <div class="creator-stat">


                            <span class="stat-label">

                                体重

                            </span>


                            <strong>

                                ${
                                    item.weight ||
                                    "--"
                                }

                                kg

                            </strong>


                        </div>


                    </div>



                    <div class="creator-size">


                        <span>

                            推荐尺码

                        </span>


                        <strong>

                            ${escapeHTML(
                                item.size ||
                                "--"
                            )}

                        </strong>


                    </div>



                    <div class="creator-fit">


                        <span class="fit-label">

                            穿着效果

                        </span>


                        <span class="fit-text">

                            ${escapeHTML(
                                item.fit ||
                                "暂无描述"
                            )}

                        </span>


                    </div>



                    ${videoButton}


                </div>

            `;

        }
    );

}


// =====================================================
// 没有产品
// =====================================================

function showNoProducts(message) {

    const select =
        document.getElementById(
            "size-product"
        );


    if (!select) {

        return;

    }


    select.innerHTML = "";


    const option =
        document.createElement(
            "option"
        );


    option.value = "";


    option.textContent =
        message;


    select.appendChild(
        option
    );

}


// =====================================================
// 打开达人视频
// =====================================================

function openVideo(url) {

    if (!url) {

        alert(
            "暂无视频链接"
        );

        return;

    }


    window.open(
        url,
        "_blank"
    );

}


// =====================================================
// 暴露全局
// =====================================================

window.loadCreators =
    loadCreators;

window.loadProducts =
    loadProducts;

window.renderProductSelect =
    renderProductSelect;

window.renderCreators =
    renderCreators;

window.getCurrentProductCreators =
    getCurrentProductCreators;

window.openVideo =
    openVideo;

window.cleanProductName =
    cleanProductName;


// =====================================================
// 页面初始化
// =====================================================

async function initSizePage() {

    console.log("================================");
    console.log("🚀 真人尺码参考开始初始化");
    console.log("================================");


    // =================================================
    // 先加载产品
    // =================================================

    await loadProducts();


    // =================================================
    // 再加载达人
    // =================================================

    await loadCreators();


    console.log("================================");
    console.log("✅ 真人尺码参考初始化完成");
    console.log("================================");

}


// =====================================================
// DOM 加载完成
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "📄 真人尺码参考页面加载完成"
        );


        window.creatorsReady =
            initSizePage();

    }
);


console.log(
    "✅ size.js 加载完成"
);