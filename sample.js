console.log("Sample audit loaded!");


// =====================
// 数据读取
// =====================


let sampleData =
JSON.parse(
localStorage.getItem("sampleData")
) || [];


// 当前排序方式

let sortType = "default";




// =====================
// 添加记录
// =====================


function addSample(){


let handle =
document.getElementById("handle").value;


let product =
document.getElementById("product").value;


let date =
document.getElementById("apply-date").value;


let remark =
document.getElementById("remark").value;




if(!handle || !date){

alert("请填写达人Handle和申请时间");

return;

}



sampleData.push({

handle:handle,

product:product,

date:date,

remark:remark

});



saveData();

render();




document.getElementById("handle").value="";

document.getElementById("product").value="";

document.getElementById("apply-date").value="";

document.getElementById("remark").value="";


}







// =====================
// 计算剩余通过时间
// =====================


function getDays(date){


let today =
new Date();


let apply =
new Date(date);



today.setHours(0,0,0,0);

apply.setHours(0,0,0,0);



return Math.floor(

(today-apply)

/(1000*60*60*24)

);


}








// =====================
// 日期选择器
// =====================


function enableDatePicker(){


document
.querySelectorAll(
"input[type='date']"
)
.forEach(function(input){



input.onclick=function(){



if(this.showPicker){


this.showPicker();


}


};



});


}







// =====================
// 渲染列表
// =====================


function render(){


let box =
document.getElementById(
"sample-list"
);



if(!box){

return;

}



box.innerHTML="";




// 排序


if(sortType==="asc"){


sampleData.sort(function(a,b){


return getDays(a.date)-getDays(b.date);


});


}



if(sortType==="desc"){


sampleData.sort(function(a,b){


return getDays(b.date)-getDays(a.date);


});


}






sampleData.forEach(
function(item,index){



let days =
getDays(item.date);



let color="";



if(days>2){

color="sample-green";


}
else if(days===2){


color="sample-yellow";


}
else if(days<=1){


color="sample-red";


}





box.innerHTML += `


<tr>



<td>

<input

class="table-input"

value="${item.handle}"

onchange="updateData(${index},'handle',this.value)"

>

</td>




<td>

<input

class="table-input"

value="${item.product || ''}"

onchange="updateData(${index},'product',this.value)"

>

</td>





<td>

<input

class="table-input"

type="date"

value="${item.date}"

onchange="updateData(${index},'date',this.value)"

>

</td>





<td>

<span class="${color}">

${days} 天

</span>

</td>





<td>

<input

class="table-input"

value="${item.remark || ''}"

onchange="updateData(${index},'remark',this.value)"

>

</td>





<td>

<button

onclick="removeSample(${index})">

删除

</button>

</td>




</tr>


`;



});




// 重点：动态生成后重新绑定

enableDatePicker();


}









// =====================
// 修改数据
// =====================


function updateData(index,key,value){


sampleData[index][key]=value;


saveData();


render();


}








// =====================
// 删除
// =====================


function removeSample(index){


sampleData.splice(

index,

1

);


saveData();


render();


}








// =====================
// 排序
// =====================


function sortSample(type){


sortType=type;


render();


}








// =====================
// 保存
// =====================


function saveData(){


localStorage.setItem(

"sampleData",

JSON.stringify(sampleData)

);


}








// =====================
// 页面加载
// =====================


document.addEventListener(

"DOMContentLoaded",

function(){


render();



let dateInput =

document.getElementById(
"apply-date"
);



if(dateInput){


dateInput.addEventListener(
"click",
function(){


if(this.showPicker){


this.showPicker();


}


});


}



}

);