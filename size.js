// =====================================================
// size.js
// 尺码助手
// 最终独立版
// =====================================================


console.log("================================");
console.log("size.js 正在加载");
console.log("================================");


// =====================================================
// 全局数据
// =====================================================

window.currentBody = null;

window.sizeAssistantCreators = [];

window.sizeAssistantProducts = [];


// =====================================================
// Supabase
// =====================================================

async function waitForSupabase() {

    for (let i = 0; i < 30; i++) {

        if (window.supabaseClient) {

            console.log(
                "✅ Supabase Client 已准备好"
            );

            return window.supabaseClient;
        }


        console.log(
            "等待 Supabase...",
            i + 1
        );


        await new Promise(function(resolve) {

            setTimeout(
                resolve,
                300
            );

        });

    }


    console.error(
        "❌ Supabase Client 加载失败"
    );

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
// TikTok URL 标准化
// =====================================================

function normalizeVideoURL(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    let url =
        String(value)
            .trim();


    if (!url) {

        return "";
    }


    // 去掉前后引号

    url =
        url
            .replace(/^["']+/, "")
            .replace(/["']+$/, "")
            .trim();


    // 自动补 HTTPS

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {

        url =
            "https://" +
            url;
    }


    return url;
}


// =====================================================
// 打开达人视频
// =====================================================

function openCreatorVideo(url) {

    const finalURL =
        normalizeVideoURL(
            url
        );


    if (!finalURL) {

        alert(
            "该达人暂无视频链接"
        );

        return;
    }


    try {

        const newWindow =
            window.open(
                finalURL,
                "_blank",
                "noopener,noreferrer"
            );


        if (!newWindow) {

            alert(
                "浏览器阻止了新窗口，请允许当前网站打开新标签页"
            );
        }


    } catch (error) {

        console.error(
            "打开视频失败:",
            error
        );


        window.location.href =
            finalURL;
    }
}


// =====================================================
// 产品名称标准化
// =====================================================

function normalizeProductName(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)

        .replace(
            /\s+/g,
            " "
        )

        .trim();
}


// =====================================================
// 产品匹配 Key
// =====================================================

function getProductKey(value) {

    let product =
        normalizeProductName(
            value
        );


    if (!product) {

        return "";
    }


    // =================================================
    // 颜色
    // =================================================

    const colors =
        "black|white|grey|gray|navy|blue|red|green|brown|beige|cream|khaki|tan|burgundy|wine|off\\s*white|charcoal|olive";


    // =================================================
    // 尺码
    // =================================================

    const sizes =
        "XXXL|XXL|3XL|2XL|XL|XS|S|M|L";


    // =================================================
    // 产品 - Black - M
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
    // 产品 - M
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
    // 产品 - Black
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
    // 产品 (Black)
    // 产品 (Black, M)
    // =================================================

    product =
        product.replace(
            /\s*\([^)]*\)\s*$/,
            ""
        );


    // =================================================
    // 清理
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
            .trim()
            .toLowerCase();


    return product;
}


// =====================================================
// 显示产品错误
// =====================================================

function showProductError(message) {

    const select =
        document.getElementById(
            "productSelect"
        );


    if (!select) {

        return;
    }


    select.innerHTML = `

        <option value="">

            ${escapeHTML(message)}

        </option>

    `;
}


// =====================================================
// 读取达人数据
// =====================================================

async function loadCreatorsForSizeAssistant() {

    console.log("================================");
    console.log("👤 开始读取达人数据");
    console.log("================================");


    const client =
        await waitForSupabase();


    if (!client) {

        showProductError(
            "Supabase 连接失败"
        );

        return [];
    }


    const {
        data,
        error
    } =
        await client
            .from("creators")
            .select("*");


    if (error) {

        console.error(
            "❌ creators 数据读取失败:",
            error
        );


        showProductError(
            "达人数据读取失败"
        );


        return [];
    }


    console.log(
        "✅ creators 原始数据:",
        data
    );


    if (
        !data ||
        data.length === 0
    ) {

        window.sizeAssistantCreators = [];

        window.sizeAssistantProducts = [];


        showProductError(
            "达人尺码管理中暂无产品"
        );


        return [];
    }


    // =================================================
    // 保存达人数据
    // =================================================

    window.sizeAssistantCreators =

        data

            .map(function(item) {

                return {

                    id:
                        item.id,

                    name:
                        String(
                            item.handle ?? ""
                        )
                        .trim(),

                    product:
                        normalizeProductName(
                            item.product
                        ),

                    productKey:
                        getProductKey(
                            item.product
                        ),

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
                        normalizeVideoURL(
                            item.video_url
                        )

                };

            })

            .filter(function(item) {

                return (
                    item.productKey !== ""
                );

            });


    console.log(
        "================================"
    );

    console.log(
        "✅ 尺码助手达人数量:",
        window.sizeAssistantCreators.length
    );

    console.log(
        "================================"
    );


    // =================================================
    // 生成产品列表
    // =================================================

    const productMap =
        new Map();


    window.sizeAssistantCreators.forEach(
        function(item) {

            const key =
                item.productKey;


            if (
                !productMap.has(key)
            ) {

                productMap.set(
                    key,
                    item.product
                );
            }

        }
    );


    window.sizeAssistantProducts =
        Array.from(
            productMap.values()
        );


    console.log(
        "📦 尺码助手产品列表:",
        window.sizeAssistantProducts
    );


    renderProductSelect();


    return window.sizeAssistantCreators;
}


// =====================================================
// 生成产品下拉框
// =====================================================

function renderProductSelect() {

    const select =
        document.getElementById(
            "productSelect"
        );


    if (!select) {

        console.error(
            "❌ 找不到 #productSelect"
        );

        return;
    }


    const products =
        window.sizeAssistantProducts;


    select.innerHTML = "";


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
            "达人尺码管理中暂无产品";


        select.appendChild(
            option
        );


        return;
    }


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


    products.forEach(
        function(product) {

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


    console.log(
        "✅ 产品下拉框生成完成"
    );
}


// =====================================================
// 产品选择变化
// =====================================================

function handleProductChange() {

    const select =
        document.getElementById(
            "productSelect"
        );


    const result =
        document.getElementById(
            "creatorResult"
        );


    if (
        !select ||
        !result
    ) {

        return;
    }


    const product =
        normalizeProductName(
            select.value
        );


    if (!product) {

        result.innerHTML = `

            <p>
                请选择产品后查看参考达人
            </p>

        `;

        return;
    }


    result.innerHTML = `

        <p>

            已选择：

            <strong>
                ${escapeHTML(product)}
            </strong>

            <br>

            点击「查看参考达人」进行匹配

        </p>

    `;
}


// =====================================================
// 身高体重换算
// =====================================================

function convertHeightWeight() {

    const ftInput =
        document.getElementById(
            "height-ft"
        );


    const inchInput =
        document.getElementById(
            "height-in"
        );


    const lbsInput =
        document.getElementById(
            "weight-lbs"
        );


    const result =
        document.getElementById(
            "result"
        );


    if (
        !ftInput ||
        !inchInput ||
        !lbsInput ||
        !result
    ) {

        return;
    }


    const ft =
        Number(
            ftInput.value
        ) || 0;


    const inch =
        Number(
            inchInput.value
        ) || 0;


    const lbs =
        Number(
            lbsInput.value
        ) || 0;


    if (
        ft <= 0 &&
        inch <= 0
    ) {

        alert(
            "请输入身高"
        );

        return;
    }


    if (
        lbs <= 0
    ) {

        alert(
            "请输入体重"
        );

        return;
    }


    const cm =
        ft * 30.48 +
        inch * 2.54;


    const kg =
        lbs * 0.453592;


    const finalCm =
        Number(
            cm.toFixed(1)
        );


    const finalKg =
        Number(
            kg.toFixed(1)
        );


    window.currentBody = {

        height:
            finalCm,

        weight:
            finalKg

    };


    result.innerHTML = `

        <div class="height-result">

            <div class="height-result-item">

                <span>
                    身高
                </span>

                <strong>
                    ${finalCm} cm
                </strong>

            </div>


            <div class="height-result-item">

                <span>
                    体重
                </span>

                <strong>
                    ${finalKg} kg
                </strong>

            </div>

        </div>

    `;


    console.log(
        "✅ 身高体重计算完成:",
        window.currentBody
    );
}


// =====================================================
// 查找最接近达人
// =====================================================

function findCreatorSize() {

    console.log("================================");
    console.log("开始匹配达人");
    console.log("================================");


    if (
        !window.currentBody
    ) {

        alert(
            "请先计算身高体重"
        );

        return;
    }


    const productSelect =
        document.getElementById(
            "productSelect"
        );


    const result =
        document.getElementById(
            "creatorResult"
        );


    if (
        !productSelect ||
        !result
    ) {

        return;
    }


    const product =
        normalizeProductName(
            productSelect.value
        );


    if (!product) {

        alert(
            "请先选择产品"
        );

        return;
    }


    const productKey =
        getProductKey(
            product
        );


    console.log(
        "当前产品:",
        product
    );


    console.log(
        "当前产品 Key:",
        productKey
    );


    const creators =

        window.sizeAssistantCreators.filter(
            function(item) {

                return (
                    item.productKey ===
                    productKey
                );

            }
        );


    console.log(
        "当前产品达人:",
        creators
    );


    if (
        creators.length === 0
    ) {

        result.innerHTML = `

            <div class="size-result-empty">

                暂无
                <strong>
                    ${escapeHTML(product)}
                </strong>
                的达人数据

            </div>

        `;

        return;
    }


    const targetHeight =
        Number(
            window.currentBody.height
        ) || 0;


    const targetWeight =
        Number(
            window.currentBody.weight
        ) || 0;


    const sortedCreators =

        creators

            .map(function(item) {

                const creatorHeight =
                    Number(
                        item.height
                    ) || 0;


                const creatorWeight =
                    Number(
                        item.weight
                    ) || 0;


                const heightDiff =
                    Math.abs(
                        creatorHeight -
                        targetHeight
                    );


                const weightDiff =
                    Math.abs(
                        creatorWeight -
                        targetWeight
                    );


                const distance =
                    heightDiff +
                    weightDiff * 0.5;


                return {

                    ...item,

                    distance:
                        distance

                };

            })

            .sort(function(a, b) {

                return (
                    a.distance -
                    b.distance
                );

            });


    const bestCreators =
        sortedCreators.slice(
            0,
            4
        );


    // =================================================
    // 渲染结果
    // =================================================

    result.innerHTML = `

        <div class="matched-creator-title">

            最接近你的达人

        </div>


        <div class="matched-creator-list">

            ${

                bestCreators

                    .map(function(item, index) {

                        let videoButton = "";


                        if (
                            item.video
                        ) {

                            videoButton = `

                                <a

                                    class="video-btn"

                                    href="${escapeHTML(
                                        item.video
                                    )}"

                                    target="_blank"

                                    rel="noopener noreferrer"

                                >

                                    🎬 查看达人视频

                                </a>

                            `;

                        } else {

                            videoButton = `

                                <button

                                    class="video-btn video-disabled"

                                    type="button"

                                    disabled

                                >

                                    暂无达人视频

                                </button>

                            `;

                        }


                        return `

                            <div
                                class="matched-creator-card"
                            >


                                <div
                                    class="matched-creator-avatar"
                                >

                                    👕


                                </div>



                                <div
                                    class="matched-creator-info"
                                >


                                    <div
                                        class="size-creator-name-row"
                                    >

                                        <h3>

                                            ${escapeHTML(
                                                item.name ||
                                                "未命名达人"
                                            )}

                                        </h3>


                                    </div>



                                    <div
                                        class="matched-product"
                                    >

                                        ${escapeHTML(
                                            item.product ||
                                            "暂无产品"
                                        )}

                                    </div>



                                    <div
                                        class="matched-body"
                                    >

                                        <span>

                                            ${
                                                item.height ||
                                                "--"
                                            }

                                            cm

                                        </span>


                                        <span>

                                            ${
                                                item.weight ||
                                                "--"
                                            }

                                            kg

                                        </span>

                                    </div>



                                    <div
                                        class="matched-size"
                                    >

                                        <span>
                                            推荐尺码：
                                        </span>


                                        <strong>

                                            ${escapeHTML(
                                                item.size ||
                                                "--"
                                            )}

                                        </strong>

                                    </div>



                                    ${
                                        item.fit

                                        ?

                                        `

                                            <div
                                                class="matched-fit"
                                            >

                                                ${escapeHTML(
                                                    item.fit
                                                )}

                                            </div>

                                        `

                                        :

                                        ""

                                    }



                                    ${videoButton}


                                </div>


                            </div>

                        `;

                    })

                    .join("")

            }

        </div>

    `;


    console.log(
        "✅ 达人匹配完成:",
        bestCreators
    );
}


// =====================================================
// DOM Ready
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log("================================");
        console.log("📄 尺码助手 DOM 加载完成");
        console.log("================================");


        // =================================================
        // 计算按钮
        // =================================================

        const convertBtn =
            document.getElementById(
                "convertBtn"
            );


        if (convertBtn) {

            convertBtn.addEventListener(
                "click",
                convertHeightWeight
            );

        }


        // =================================================
        // 产品选择
        // =================================================

        const productSelect =
            document.getElementById(
                "productSelect"
            );


        if (productSelect) {

            productSelect.addEventListener(
                "change",
                handleProductChange
            );

        }


        // =================================================
        // 达人匹配按钮
        // =================================================

        const creatorMatchBtn =
            document.getElementById(
                "creatorMatchBtn"
            );


        if (creatorMatchBtn) {

            creatorMatchBtn.addEventListener(
                "click",
                findCreatorSize
            );

        }


        // =================================================
        // 加载达人
        // =================================================

        await loadCreatorsForSizeAssistant();


        console.log("================================");
        console.log("✅ 尺码助手初始化完成");
        console.log("================================");

    }
);


// =====================================================
// 暴露全局
// =====================================================

window.convertHeightWeight =
    convertHeightWeight;

window.findCreatorSize =
    findCreatorSize;

window.loadCreatorsForSizeAssistant =
    loadCreatorsForSizeAssistant;

window.normalizeProductName =
    normalizeProductName;

window.getProductKey =
    getProductKey;

window.openCreatorVideo =
    openCreatorVideo;

window.normalizeVideoURL =
    normalizeVideoURL;


console.log(
    "✅ size.js 加载完成"
);