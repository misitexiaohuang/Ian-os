console.log("TC calculator loaded!");


// =======================
// 月份变化
// =======================


document.addEventListener(
"DOMContentLoaded",
function(){


let monthInput =
document.getElementById(
"month"
);



if(monthInput){


monthInput.addEventListener(
"change",
function(){


generateDays();


saveData();


});


}



});




// =======================
// 生成每日表格
// =======================


function generateDays(){


let monthValue =
document.getElementById("month").value;



if(!monthValue){

return;

}




let [year,month] =
monthValue.split("-");




let days =
new Date(
year,
month,
0
).getDate();





let container =
document.getElementById(
"daily-container"
);



if(!container){

return;

}



container.innerHTML="";




for(
let i=1;
i<=days;
i++
){



let row =
document.createElement("tr");



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



container.appendChild(row);





row
.querySelectorAll("input")
.forEach(function(input){



input.addEventListener(
"input",
function(){


saveData();


calculateMoneyTotal();


calculateSalesForecast();


calculateTC();



});


});



}






// 恢复每日数据


let saved =
localStorage.getItem(
"TC_Data"
);



if(saved){



let data =
JSON.parse(saved);





if(data.dailyMoney){



document
.querySelectorAll(
".daily-money"
)
.forEach(function(input,index){



input.value =
data.dailyMoney[index] || "";



});


}







if(data.dailySales){



document
.querySelectorAll(
".daily-sales"
)
.forEach(function(input,index){



input.value =
data.dailySales[index] || "";


});



}



}




calculateMoneyTotal();


calculateSalesForecast();



}







// =======================
// 自动填充
// =======================


function fillDailyMoney(){



let money =
document
.getElementById(
"default-money"
)
.value;





document
.querySelectorAll(
".daily-money"
)
.forEach(function(input){



input.value =
money;



});




calculateMoneyTotal();


saveData();



}






// =======================
// 月结算金额
// =======================


function calculateMoneyTotal(){



let total=0;




document
.querySelectorAll(
".daily-money"
)
.forEach(function(input){



total += Number(
input.value || 0
);



});





let rate =
Number(
document
.getElementById(
"exchange-rate"
)
?.value || 0
);




let rmb =
total * rate;





let result =
document.getElementById(
"money-result"
);





if(result){



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



}

// =======================
// 销量预测
// =======================


function calculateSalesForecast(){


let total=0;


let filled=0;



let inputs =
document
.querySelectorAll(
".daily-sales"
);




inputs.forEach(function(input){



if(input.value){


total += Number(
input.value
);


filled++;


}


});





let result =
document.getElementById(
"sales-result"
);





if(!result){

return;

}






if(filled===0){


result.innerHTML =
"等待输入销量";


return;


}







let avg =
total / filled;




let remaining =
inputs.length-filled;



let forecast =
avg * remaining;



let totalForecast =
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









// =======================
// TC计算
// =======================


function calculateTC(){



let revenue=0;



let moneyResult =
document.getElementById(
"money-result"
);





if(moneyResult){



let match =
moneyResult.innerText.match(
/¥([\d.]+)/
);



if(match){


revenue =
Number(match[1]);


}


}






let sales=0;



let salesResult =
document.getElementById(
"sales-result"
);





if(salesResult){



let match =
salesResult.innerText.match(
/预计月销量：\s*([\d.]+)/
);




if(match){


sales =
Number(match[1]);


}



}








let productCost =
Number(
document
.getElementById(
"product-cost"
)
?.value || 0
);



let goodsCost =
sales *
productCost;








let adsUSD =
Number(
document
.getElementById(
"ads-cost"
)
?.value || 0
);






let rate =
Number(
document
.getElementById(
"exchange-rate"
)
?.value || 0
);





let adsRMB =
adsUSD *
rate;






let warehouse =
Number(
document
.getElementById(
"warehouse-cost"
)
?.value || 0
);






let shipping =
Number(
document
.getElementById(
"shipping-cost"
)
?.value || 0
);






let sample =
Number(
document
.getElementById(
"sample-cost"
)
?.value || 0
);






let other =
Number(
document
.getElementById(
"other-cost"
)
?.value || 0
);






let socialSecurity =
Number(
document
.getElementById(
"social-security-cost"
)
?.value || 0
);






let deduction =
Number(
document
.getElementById(
"deduction-cost"
)
?.value || 0
);







let totalCost =


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






let profit =

revenue -

totalCost;






let tc =

profit *

0.05;






let result =
document.getElementById(
"commission-result"
);






if(result){



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



}

// =======================
// 保存数据
// =======================


function saveData(){



let data={};




document
.querySelectorAll(
"input"
)
.forEach(function(input){



if(input.id){


data[input.id]=
input.value;


}


});






data.dailyMoney=[];



document
.querySelectorAll(
".daily-money"
)
.forEach(function(input){


data.dailyMoney.push(
input.value
);


});







data.dailySales=[];



document
.querySelectorAll(
".daily-sales"
)
.forEach(function(input){


data.dailySales.push(
input.value
);


});







localStorage.setItem(

"TC_Data",

JSON.stringify(data)

);



}









// =======================
// 加载数据
// =======================


function loadData(){



let saved =
localStorage.getItem(
"TC_Data"
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







calculateMoneyTotal();


calculateSalesForecast();


calculateTC();



}










// =======================
// 页面加载
// =======================


document.addEventListener(
"DOMContentLoaded",
function(){





// 月份选择器

let monthInput =
document.getElementById(
"month"
);





if(monthInput){


monthInput.addEventListener(
"click",
function(){


if(this.showPicker){


this.showPicker();


}



});


}









// 恢复月份


let saved =
localStorage.getItem(
"TC_Data"
);




if(saved){



let data =
JSON.parse(saved);




if(data.month){



let month =
document.getElementById(
"month"
);



if(month){



month.value =
data.month;



generateDays();



}



}



}







loadData();








// 全局输入监听


document
.querySelectorAll(
"input"
)
.forEach(function(input){



input.addEventListener(
"input",
function(){



saveData();


calculateMoneyTotal();


calculateSalesForecast();


calculateTC();



});


});







});