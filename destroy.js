console.log("Destroy calculator loaded!");


// =======================
// 计算销毁费用
// =======================


function calculateDestroy(){


    // 汇率

    let rate =
    Number(
        document
        .getElementById(
            "exchange-rate"
        )
        .value || 0
    );



    // 产品货本

    let goodsCost =
    Number(
        document
        .getElementById(
            "goods-cost"
        )
        .value || 0
    );



    // 数量

    let quantity =
    Number(
        document
        .getElementById(
            "quantity"
        )
        .value || 0
    );



    // 单件重量 g

    let weight =
    Number(
        document
        .getElementById(
            "weight"
        )
        .value || 0
    );



    // 销毁费 USD/kg

    let destroyFee =
    Number(
        document
        .getElementById(
            "destroy-fee"
        )
        .value || 0
    );



    // 单件出库费 USD

    let outboundFee =
    Number(
        document
        .getElementById(
            "outbound-fee"
        )
        .value || 0
    );





    // =======================
    // 开始计算
    // =======================


    // 货本成本

    let goodsTotal =
    goodsCost *
    quantity;





    // 总重量 KG

    let totalWeight =
    (weight / 1000) *
    quantity;





    // 销毁费用 USD

    let destroyUSD =
    destroyFee *
    totalWeight;




    // 销毁费用 RMB

    let destroyRMB =
    destroyUSD *
    rate;





    // 出库费用 USD

    let outboundUSD =
    outboundFee *
    quantity;




    // 出库费用 RMB

    let outboundRMB =
    outboundUSD *
    rate;







    // 总销毁费用

    let totalDestroyCost =

    goodsTotal
    +
    destroyRMB
    +
    outboundRMB;





    // 平均每件亏损

    let avgLoss = 0;


    if(quantity > 0){

        avgLoss =
        totalDestroyCost /
        quantity;

    }







    document
    .getElementById(
        "destroy-result"
    )
    .innerHTML =


    `

    📦 货本成本：

    <strong>
    ¥${goodsTotal.toFixed(2)}
    </strong>


    <br><br>


    ⚖️ 总重量：

    <strong>
    ${totalWeight.toFixed(2)} KG
    </strong>


    <br><br>


    🗑️ 销毁费用：

    <strong>
    ¥${destroyRMB.toFixed(2)}
    </strong>


    <br><br>


    🚚 出库费用：

    <strong>
    ¥${outboundRMB.toFixed(2)}
    </strong>


    <br><br>


    ━━━━━━━━━


    <br><br>


    💸 总销毁费用：

    <strong>
    ¥${totalDestroyCost.toFixed(2)}
    </strong>


    <br><br>


    📉 平均每件亏损：

    <strong>
    ¥${avgLoss.toFixed(2)} / 件
    </strong>


    `;



    saveDestroyData();



}








// =======================
// 保存数据
// =======================

function saveDestroyData(){


    let data = {};



    document
    .querySelectorAll(
        "input"
    )
    .forEach(function(input){


        data[input.id] =
        input.value;


    });



    localStorage.setItem(
        "Destroy_Data",
        JSON.stringify(data)
    );


}








// =======================
// 加载数据
// =======================

function loadDestroyData(){


    let saved =
    localStorage.getItem(
        "Destroy_Data"
    );



    if(!saved){

        return;

    }



    let data =
    JSON.parse(saved);



    Object.keys(data)
    .forEach(function(key){


        let input =
        document.getElementById(
            key
        );



        if(input){

            input.value =
            data[key];

        }


    });



}








// =======================
// 页面加载
// =======================

window.onload=function(){


    loadDestroyData();


};








// =======================
// 输入自动保存
// =======================


document
.querySelectorAll(
"input"
)
.forEach(function(input){


    input.addEventListener(
        "input",
        function(){

            saveDestroyData();

        }
    );


});