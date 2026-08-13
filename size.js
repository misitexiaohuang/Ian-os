// =====================================================
// 尺码助手
// size.js
// =====================================================

console.log("================================");
console.log("👕 尺码助手开始加载");
console.log("================================");



// =====================================================
// 全局数据
// =====================================================

window.currentBody = null;

window.sizeAssistantCreators = [];

window.sizeAssistantProducts = [];



// =====================================================
// 等待 Supabase
// =====================================================

async function waitForSupabase() {

    for (
        let i = 0;
        i < 30;
        i++
    ) {

        if (
            window.supabaseClient
        ) {

            console.log(
                "✅ Supabase Client 已准备好"
            );

            return window.supabaseClient;

        }


        /*
         * 不再打印
         *
         * 「等待 Supabase... 1」
         * 「等待 Supabase... 2」
         *
         * 页面和控制台都保持干净
         */


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    300
                )
        );

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
        normalizeProductName(value);


    if (!product) {

        return "";

    }


    const colors =
        "black|white|grey|gray|navy|blue|red|green|brown|beige|cream|khaki|tan|burgundy|wine|off\\s*white|charcoal|olive";


    const sizes =
        "XXXL|XXL|3XL|2XL|XL|XS|S|M|L";



    // =================================================
    // 颜色 + 尺码
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
    // =================================================

    product =
        product.replace(
            /\s*\([^)]*\)\s*$/,
            ""
        );



    return product

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

        /*
         * 不再把错误显示到页面
         */

        showProductError(
            "Supabase 连接失败"
        );

        return [];

    }



    // =================================================
    // 从 Supabase 读取 creators
    // =================================================

    const {
        data,
        error
    } = await client

        .from("creators")

        .select("*");



    // =================================================
    // 读取失败
    // =================================================

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



    // =================================================
    // 没有数据
    // =================================================

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
    // 转换达人数据
    // =================================================

    window.sizeAssistantCreators =

        data

            .map(
                function(item) {

                    return {

                        id:
                            item.id,

                        name:
                            String(
                                item.handle ??
                                ""
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
                                item.size ??
                                ""
                            )
                            .trim(),

                        fit:
                            String(
                                item.fit ??
                                ""
                            )
                            .trim(),

                        video:
                            String(
                                item.video_url ??
                                ""
                            )
                            .trim()

                    };

                }
            )

            .filter(
                function(item) {

                    return (
                        item.productKey !== ""
                    );

                }
            );



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
        "================================"
    );


    console.log(
        "📦 尺码助手产品列表:",
        window.sizeAssistantProducts
    );


    console.log(
        "产品数量:",
        window.sizeAssistantProducts.length
    );


    console.log(
        "================================"
    );



    // =================================================
    // 更新产品下拉框
    // =================================================

    renderProductSelect();



    return window.sizeAssistantCreators;

}



// =====================================================
// 产品下拉框
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



    /*
     * 清空原本的「请选择产品」
     */

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
            "请选择产品";


        select.appendChild(
            option
        );


        return;

    }



    // =================================================
    // 默认选项
    // =================================================

    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value =
        "";


    defaultOption.textContent =
        "请选择产品";


    select.appendChild(
        defaultOption
    );



    // =================================================
    // 产品
    // =================================================

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



    console.log(
        "👕 当前选择产品:",
        product
    );



    if (!product) {

        result.innerHTML = `

            <p>
                等待匹配...
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



    // =================================================
    // 检查身高
    // =================================================

    if (
        ft <= 0 &&
        inch <= 0
    ) {

        alert(
            "请输入身高"
        );

        return;

    }



    // =================================================
    // 检查体重
    // =================================================

    if (
        lbs <= 0
    ) {

        alert(
            "请输入体重"
        );

        return;

    }



    // =================================================
    // 换算
    // =================================================

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



    // =================================================
    // 保存当前身材
    // =================================================

    window.currentBody = {

        height:
            finalCm,

        weight:
            finalKg

    };



    // =================================================
    // 显示结果
    // =================================================

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

    console.log(
        "================================"
    );

    console.log(
        "开始匹配达人"
    );

    console.log(
        "================================"
    );



    // =================================================
    // 检查身材
    // =================================================

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



    // =================================================
    // 当前产品
    // =================================================

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



    // =================================================
    // 筛选产品达人
    // =================================================

    let creators =

        window.sizeAssistantCreators

            .filter(
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



    // =================================================
    // 没有达人
    // =================================================

    if (
        creators.length === 0
    ) {

        result.innerHTML = `

            <div
                style="
                    padding:20px;
                    color:#86909c;
                "
            >

                暂无
                ${escapeHTML(product)}
                的达人数据

            </div>

        `;

        return;

    }



    // =================================================
    // 当前用户身材
    // =================================================

    const targetHeight =
        Number(
            window.currentBody.height
        ) || 0;


    const targetWeight =
        Number(
            window.currentBody.weight
        ) || 0;



    // =================================================
    // 计算身材距离
    // =================================================

    const sortedCreators =

        creators

            .map(
                function(item) {

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



                    /*
                     * 身高差权重：1
                     * 体重差权重：0.5
                     *
                     * 数值越小
                     * 身材越接近
                     */

                    const distance =
                        heightDiff +
                        weightDiff * 0.5;



                    return {

                        ...item,

                        distance:
                            distance

                    };

                }
            )

            .sort(
                function(a, b) {

                    return (
                        a.distance -
                        b.distance
                    );

                }
            );



    // =================================================
    // 取最接近的 4 个
    // =================================================

    const bestCreators =
        sortedCreators.slice(
            0,
            4
        );



    // =================================================
    // 生成视频按钮
    // =================================================

    function createVideoButton(item) {

        if (
            item.video
        ) {

            return `

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

        }



        return `

            <button

                class="video-btn video-disabled"

                type="button"

                disabled

            >

                暂无达人视频

            </button>

        `;

    }



    // =================================================
    // 生成达人卡片
    // =================================================

    result.innerHTML = `

        <div
            class="matched-creator-title"
        >

            最接近你的达人

        </div>


        <div
            class="matched-creator-list"
        >

            ${

                bestCreators

                    .map(
                        function(item) {

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


                                        <h3>

                                            ${escapeHTML(
                                                item.name ||
                                                "未命名达人"
                                            )}

                                        </h3>



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



                                        ${createVideoButton(
                                            item
                                        )}


                                    </div>


                                </div>

                            `;

                        }
                    )

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
// 产品读取失败
// =====================================================

function showProductError(message) {

    /*
     * 重要：
     *
     * 不再把错误文字写到页面。
     *
     * 页面始终保持：
     *
     * 「请选择产品」
     *
     * 如果真的出错，
     * 只在 Console 里面记录。
     */

    console.error(
        "尺码助手数据加载失败:",
        message
    );


    const select =
        document.getElementById(
            "productSelect"
        );


    if (
        select &&
        select.options.length === 0
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            "请选择产品";


        select.appendChild(
            option
        );

    }

}



// =====================================================
// 页面初始化
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "================================"
        );

        console.log(
            "📄 尺码助手 DOM 加载完成"
        );

        console.log(
            "================================"
        );



        // =================================================
        // 身高体重按钮
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
        // 达人匹配
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



        /*
         * =================================================
         * 关键：
         *
         * 这里虽然读取 Supabase，
         * 但不会阻止页面显示。
         *
         * 页面已经正常打开。
         *
         * 数据在后台读取。
         * =================================================
         */

        loadCreatorsForSizeAssistant()

            .then(
                function() {

                    console.log(
                        "================================"
                    );

                    console.log(
                        "✅ 尺码助手初始化完成"
                    );

                    console.log(
                        "================================"
                    );

                }
            )

            .catch(
                function(error) {

                    console.error(
                        "❌ 尺码助手后台读取失败:",
                        error
                    );

                }
            );

    }
);



// =====================================================
// 暴露全局函数
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



console.log(
    "✅ 尺码助手核心程序加载成功"
);