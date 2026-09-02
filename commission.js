console.log("TC calculator loaded!");


// =====================================================
// Supabase / 数据状态
// =====================================================

const TC_TABLE = "tc_monthly_estimates";

let tcSaveTimer = null;

let tcSaveRequestId = 0;


// =====================================================
// 工具函数
// =====================================================

function getTCClient() {

    if (window.supabaseClient) {

        return window.supabaseClient;

    }

    if (
        window.supabase &&
        typeof window.supabase.from === "function"
    ) {

        return window.supabase;

    }

    console.error(
        "TC 页面：Supabase Client 不存在"
    );

    return null;

}


function safeJsonParse(value) {

    try {

        return JSON.parse(value);

    }
    catch (error) {

        console.warn(
            "TC JSON 数据解析失败：",
            error
        );

        return null;

    }

}


function getInputValue(id) {

    const input =
        document.getElementById(id);

    return input
        ? input.value
        : "";

}


function setInputValue(id, value) {

    const input =
        document.getElementById(id);

    if (!input) {

        return;

    }

    input.value =
        value === null ||
        value === undefined
            ? ""
            : value;

}


function getNumberValue(id) {

    const value =
        getInputValue(id);

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}


function getDailyMoneyValues() {

    return Array.from(
        document.querySelectorAll(
            ".daily-money"
        )
    ).map(function(input) {

        return input.value;

    });

}


function getDailySalesValues() {

    return Array.from(
        document.querySelectorAll(
            ".daily-sales"
        )
    ).map(function(input) {

        return input.value;

    });

}


function applyDailyValues(
    dailyMoney,
    dailySales
) {

    const moneyValues =
        Array.isArray(dailyMoney)
            ? dailyMoney
            : [];

    const salesValues =
        Array.isArray(dailySales)
            ? dailySales
            : [];


    document
        .querySelectorAll(
            ".daily-money"
        )
        .forEach(function(input, index) {

            input.value =
                moneyValues[index] || "";

        });


    document
        .querySelectorAll(
            ".daily-sales"
        )
        .forEach(function(input, index) {

            input.value =
                salesValues[index] || "";

        });

}


function getCurrentTCData() {

    return {

        month:
            getInputValue(
                "month"
            ),

        exchangeRate:
            getInputValue(
                "exchange-rate"
            ),

        defaultMoney:
            getInputValue(
                "default-money"
            ),

        productCost:
            getInputValue(
                "product-cost"
            ),

        adsCost:
            getInputValue(
                "ads-cost"
            ),

        warehouseCost:
            getInputValue(
                "warehouse-cost"
            ),

        shippingCost:
            getInputValue(
                "shipping-cost"
            ),

        sampleCost:
            getInputValue(
                "sample-cost"
            ),

        otherCost:
            getInputValue(
                "other-cost"
            ),

        socialSecurityCost:
            getInputValue(
                "social-security-cost"
            ),

        deductionCost:
            getInputValue(
                "deduction-cost"
            ),

        dailyMoney:
            getDailyMoneyValues(),

        dailySales:
            getDailySalesValues()

    };

}


// =====================================================
// 本地缓存
// =====================================================

function saveLocalData(data) {

    try {

        localStorage.setItem(
            "TC_Data",
            JSON.stringify(data)
        );

    }
    catch (error) {

        console.warn(
            "TC 本地缓存保存失败：",
            error
        );

    }

}


function loadLocalData() {

    try {

        const saved =
            localStorage.getItem(
                "TC_Data"
            );

        if (!saved) {

            return null;

        }

        return safeJsonParse(
            saved
        );

    }
    catch (error) {

        console.warn(
            "TC 本地缓存读取失败：",
            error
        );

        return null;

    }

}


// =====================================================
// 生成每日表格
// =====================================================

function generateDays(
    dailyMoney,
    dailySales
) {

    const monthValue =
        document.getElementById(
            "month"
        )?.value;


    if (!monthValue) {

        const container =
            document.getElementById(
                "daily-container"
            );

        if (container) {

            container.innerHTML = "";

        }

        return;

    }


    const parts =
        monthValue.split("-");


    if (parts.length !== 2) {

        return;

    }


    const year =
        Number(parts[0]);


    const month =
        Number(parts[1]);


    const days =
        new Date(
            year,
            month,
            0
        ).getDate();


    const container =
        document.getElementById(
            "daily-container"
        );


    if (!container) {

        return;

    }


    container.innerHTML = "";


    for (
        let i = 1;
        i <= days;
        i++
    ) {

        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `

<td>
${month}月${i}日
</td>


<td>

<input

class="daily-money"

type="number"

placeholder="USD"

>

</td>


<td>

<input

class="daily-sales"

type="number"

placeholder="件"

>

</td>

`;


        container.appendChild(
            row
        );


        row
            .querySelectorAll(
                "input"
            )
            .forEach(function(input) {

                input.addEventListener(
                    "input",
                    handleTCInput
                );

            });

    }


    applyDailyValues(
        dailyMoney,
        dailySales
    );


    calculateMoneyTotal();

    calculateSalesForecast();

    calculateTC();

}


// =====================================================
// 输入变化
// =====================================================

function handleTCInput() {

    saveData();

    calculateMoneyTotal();

    calculateSalesForecast();

    calculateTC();

}


// =====================================================
// 月份变化
// =====================================================

async function handleMonthChange() {

    const monthInput =
        document.getElementById(
            "month"
        );


    if (!monthInput) {

        return;

    }


    generateDays(
        [],
        []
    );


    await loadMonthData(
        monthInput.value
    );

}


// =====================================================
// 自动填充
// =====================================================

function fillDailyMoney() {

    const money =
        document
            .getElementById(
                "default-money"
            )
            ?.value || "";


    document
        .querySelectorAll(
            ".daily-money"
        )
        .forEach(function(input) {

            input.value =
                money;

        });


    calculateMoneyTotal();

    calculateSalesForecast();

    calculateTC();

    saveData();

}


// =====================================================
// 月结算金额
// =====================================================

function calculateMoneyTotal() {

    let total = 0;


    document
        .querySelectorAll(
            ".daily-money"
        )
        .forEach(function(input) {

            total += Number(
                input.value || 0
            );

        });


    const rate =
        Number(
            document
                .getElementById(
                    "exchange-rate"
                )
                ?.value || 0
        );


    const rmb =
        total * rate;


    const result =
        document.getElementById(
            "money-result"
        );


    if (!result) {

        return;

    }


    result.innerHTML =

`
<div class="compact-result">


<p>
💵 月结算金额：
<strong>
$${total.toFixed(2)}
</strong>
</p>



<p>
🇨🇳 人民币：
<strong>
¥${rmb.toFixed(2)}
</strong>
</p>


</div>

`;

}


// =====================================================
// 销量预测
// =====================================================

function calculateSalesForecast() {

    let total = 0;

    let filled = 0;


    const inputs =
        document.querySelectorAll(
            ".daily-sales"
        );


    inputs.forEach(function(input) {

        if (input.value !== "") {

            total += Number(
                input.value
            );

            filled++;

        }

    });


    const result =
        document.getElementById(
            "sales-result"
        );


    if (!result) {

        return;

    }


    if (filled === 0) {

        result.innerHTML =
            "等待输入销量";

        return;

    }


    const avg =
        total / filled;


    const remaining =
        inputs.length - filled;


    const forecast =
        avg * remaining;


    const totalForecast =
        total + forecast;


    result.innerHTML =

`
<div class="compact-result">


<p>
📦 已填写销量：
<strong>
${total.toFixed(0)} 件
</strong>
</p>



<p>
📈 平均日销量：
<strong>
${avg.toFixed(0)} 件/天
</strong>
</p>



<p>
🔥预计月销量：
<strong>
${totalForecast.toFixed(0)} 件
</strong>
</p>


</div>

`;

}


// =====================================================
// TC计算
// =====================================================

function calculateTC() {

    let revenue = 0;


    const moneyResult =
        document.getElementById(
            "money-result"
        );


    if (moneyResult) {

        const match =
            moneyResult.innerText.match(
                /¥([\d.]+)/
            );


        if (match) {

            revenue =
                Number(match[1]);

        }

    }


    let sales = 0;


    const salesResult =
        document.getElementById(
            "sales-result"
        );


    if (salesResult) {

        const match =
            salesResult.innerText.match(
                /预计月销量：\s*([\d.]+)/
            );


        if (match) {

            sales =
                Number(match[1]);

        }

    }


    const productCost =
        getNumberValue(
            "product-cost"
        );


    const goodsCost =
        sales *
        productCost;


    const adsUSD =
        getNumberValue(
            "ads-cost"
        );


    const rate =
        getNumberValue(
            "exchange-rate"
        );


    const adsRMB =
        adsUSD *
        rate;


    const warehouse =
        getNumberValue(
            "warehouse-cost"
        );


    const shipping =
        getNumberValue(
            "shipping-cost"
        );


    const sample =
        getNumberValue(
            "sample-cost"
        );


    const other =
        getNumberValue(
            "other-cost"
        );


    const socialSecurity =
        getNumberValue(
            "social-security-cost"
        );


    const deduction =
        getNumberValue(
            "deduction-cost"
        );


    const totalCost =

        goodsCost

        +

        adsRMB

        +

        warehouse

        +

        shipping

        +

        sample

        +

        other

        +

        socialSecurity

        +

        deduction;


    const profit =

        revenue -

        totalCost;


    const tc =

        profit *

        0.05;


    const result =
        document.getElementById(
            "commission-result"
        );


    if (!result) {

        return;

    }


    result.innerHTML =

`
<div class="compact-result">


<p>
💰 销售收入：
<strong>
¥${revenue.toFixed(2)}
</strong>
</p>



<p>
📦 货本：
<strong>
¥${goodsCost.toFixed(2)}
</strong>
</p>



<p>
📢 广告：
<strong>
¥${adsRMB.toFixed(2)}
</strong>
</p>



<p>
🏢 社保公积金：
<strong>
¥${socialSecurity.toFixed(2)}
</strong>
</p>



<p>
📌 上月待抵扣：
<strong>
¥${deduction.toFixed(2)}
</strong>
</p>



<p>
💸 总成本：
<strong>
¥${totalCost.toFixed(2)}
</strong>
</p>



<p>
📈 业务利润：
<strong>
¥${profit.toFixed(2)}
</strong>
</p>



<p class="tc-final">

🔥 预计TC：

<strong>

¥${tc.toFixed(2)}

</strong>

</p>


</div>

`;

}


// =====================================================
// 创建数据库保存数据
// =====================================================

function buildDatabasePayload(data) {

    return {

        month:
            data.month,

        exchange_rate:
            Number(data.exchangeRate || 0),

        default_money:
            Number(data.defaultMoney || 0),

        product_cost:
            Number(data.productCost || 0),

        ads_cost:
            Number(data.adsCost || 0),

        warehouse_cost:
            Number(data.warehouseCost || 0),

        shipping_cost:
            Number(data.shippingCost || 0),

        sample_cost:
            Number(data.sampleCost || 0),

        other_cost:
            Number(data.otherCost || 0),

        social_security_cost:
            Number(
                data.socialSecurityCost || 0
            ),

        deduction_cost:
            Number(
                data.deductionCost || 0
            ),

        daily_money:
            data.dailyMoney || [],

        daily_sales:
            data.dailySales || []

    };

}


// =====================================================
// 保存到 Supabase
// =====================================================

async function saveTCToSupabase(data) {

    const client =
        getTCClient();


    if (!client) {

        console.warn(
            "Supabase 客户端不存在，已仅保存到本地缓存。"
        );

        return;

    }


    if (!data.month) {

        return;

    }


    const payload =
        buildDatabasePayload(
            data
        );


    const requestId =
        ++tcSaveRequestId;


    try {

        const {
            error
        } =
            await client
                .from(
                    TC_TABLE
                )
                .upsert(
                    payload,
                    {
                        onConflict:
                            "month"
                    }
                );


        if (requestId !== tcSaveRequestId) {

            return;

        }


        if (error) {

            throw error;

        }


        console.log(
            "TC 数据已保存到 Supabase：",
            data.month
        );

    }
    catch (error) {

        console.error(
            "TC 数据保存到 Supabase 失败：",
            error
        );

    }

}


// =====================================================
// 防抖保存
// =====================================================

function scheduleSupabaseSave() {

    if (tcSaveTimer) {

        clearTimeout(
            tcSaveTimer
        );

    }


    tcSaveTimer =
        setTimeout(
            function() {

                const data =
                    getCurrentTCData();


                saveTCToSupabase(
                    data
                );

            },
            500
        );

}


// =====================================================
// 保存数据
// =====================================================

function saveData() {

    const data =
        getCurrentTCData();


    saveLocalData(
        data
    );


    scheduleSupabaseSave();

}


// =====================================================
// 从 Supabase 读取指定月份
// =====================================================

async function loadMonthData(
    month
) {

    if (!month) {

        return;

    }


    const client =
        getTCClient();


    if (!client) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await client
                .from(
                    TC_TABLE
                )
                .select("*")
                .eq(
                    "month",
                    month
                )
                .maybeSingle();


        if (error) {

            throw error;

        }


        if (data) {

            applyDatabaseData(
                data
            );

            saveLocalData(
                getCurrentTCData()
            );

            calculateMoneyTotal();

            calculateSalesForecast();

            calculateTC();

            console.log(
                "TC 数据已从 Supabase 恢复：",
                month
            );

            return;

        }


        const localData =
            loadLocalData();


        if (
            localData &&
            localData.month === month
        ) {

            applyLocalData(
                localData
            );

            calculateMoneyTotal();

            calculateSalesForecast();

            calculateTC();

            scheduleSupabaseSave();

            return;

        }


        clearCurrentMonthData();

        calculateMoneyTotal();

        calculateSalesForecast();

        calculateTC();

    }
    catch (error) {

        console.error(
            "TC 月度数据读取失败：",
            error
        );


        const localData =
            loadLocalData();


        if (
            localData &&
            localData.month === month
        ) {

            applyLocalData(
                localData
            );

            calculateMoneyTotal();

            calculateSalesForecast();

            calculateTC();

        }

    }

}


// =====================================================
// 应用数据库数据
// =====================================================

function applyDatabaseData(
    data
) {

    setInputValue(
        "month",
        data.month || ""
    );


    setInputValue(
        "exchange-rate",
        data.exchange_rate
    );


    setInputValue(
        "default-money",
        data.default_money
    );


    setInputValue(
        "product-cost",
        data.product_cost
    );


    setInputValue(
        "ads-cost",
        data.ads_cost
    );


    setInputValue(
        "warehouse-cost",
        data.warehouse_cost
    );


    setInputValue(
        "shipping-cost",
        data.shipping_cost
    );


    setInputValue(
        "sample-cost",
        data.sample_cost
    );


    setInputValue(
        "other-cost",
        data.other_cost
    );


    setInputValue(
        "social-security-cost",
        data.social_security_cost
    );


    setInputValue(
        "deduction-cost",
        data.deduction_cost
    );


    applyDailyValues(
        data.daily_money,
        data.daily_sales
    );

}


// =====================================================
// 应用本地数据
// =====================================================

function applyLocalData(
    data
) {

    if (!data) {

        return;

    }


    setInputValue(
        "exchange-rate",
        data.exchangeRate
    );


    setInputValue(
        "default-money",
        data.defaultMoney
    );


    setInputValue(
        "product-cost",
        data.productCost
    );


    setInputValue(
        "ads-cost",
        data.adsCost
    );


    setInputValue(
        "warehouse-cost",
        data.warehouseCost
    );


    setInputValue(
        "shipping-cost",
        data.shippingCost
    );


    setInputValue(
        "sample-cost",
        data.sampleCost
    );


    setInputValue(
        "other-cost",
        data.otherCost
    );


    setInputValue(
        "social-security-cost",
        data.socialSecurityCost
    );


    setInputValue(
        "deduction-cost",
        data.deductionCost
    );


    applyDailyValues(
        data.dailyMoney,
        data.dailySales
    );

}


// =====================================================
// 清空当前月份数据
// =====================================================

function clearCurrentMonthData() {

    const ids = [

        "exchange-rate",

        "default-money",

        "product-cost",

        "ads-cost",

        "warehouse-cost",

        "shipping-cost",

        "sample-cost",

        "other-cost",

        "social-security-cost",

        "deduction-cost"

    ];


    ids.forEach(function(id) {

        setInputValue(
            id,
            ""
        );

    });


    document
        .querySelectorAll(
            ".daily-money"
        )
        .forEach(function(input) {

            input.value = "";

        });


    document
        .querySelectorAll(
            ".daily-sales"
        )
        .forEach(function(input) {

            input.value = "";

        });

}


// =====================================================
// 加载数据
// =====================================================

async function loadData() {

    const month =
        getInputValue(
            "month"
        );


    if (month) {

        await loadMonthData(
            month
        );

        return;

    }


    const localData =
        loadLocalData();


    if (
        localData &&
        localData.month
    ) {

        setInputValue(
            "month",
            localData.month
        );


        generateDays(
            localData.dailyMoney,
            localData.dailySales
        );


        applyLocalData(
            localData
        );


        calculateMoneyTotal();

        calculateSalesForecast();

        calculateTC();


        await loadMonthData(
            localData.month
        );

    }

}


// =====================================================
// 页面加载
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        const monthInput =
            document.getElementById(
                "month"
            );


        if (monthInput) {

            monthInput.addEventListener(
                "click",
                function() {

                    if (
                        this.showPicker
                    ) {

                        this.showPicker();

                    }

                }
            );


            monthInput.addEventListener(
                "change",
                handleMonthChange
            );

        }


        const localData =
            loadLocalData();


        if (
            localData &&
            localData.month
        ) {

            setInputValue(
                "month",
                localData.month
            );


            generateDays(
                localData.dailyMoney,
                localData.dailySales
            );


            applyLocalData(
                localData
            );

        }


        await loadData();


        document
            .querySelectorAll(
                "input:not(.daily-money):not(.daily-sales)"
            )
            .forEach(function(input) {

                input.addEventListener(
                    "input",
                    handleTCInput
                );

            });


        calculateMoneyTotal();

        calculateSalesForecast();

        calculateTC();

    }
);
