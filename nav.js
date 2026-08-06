const menuData = [

{
id:"home",
name:"🏠 首页",
url:"index.html"
},

{
id:"height",
name:"📏 身高体重换算",
url:"height.html"
},

{
id:"commission",
name:"💰 当月TC预估",
url:"commission.html"
},

{
id:"destroy",
name:"🗑️ 销毁费用预估",
url:"destroy.html"
},

{
id:"sample",
name:"📦 寄样审核",
url:"sample.html"
}

];




// 读取保存顺序

let menuOrder =
JSON.parse(
localStorage.getItem("menuOrder")
);




// 如果没有保存，使用默认

if(!menuOrder){

menuOrder =
menuData.map(item=>item.id);

}




let dragIndex = null;





function renderMenu(){


let menu =
document.getElementById("menu");


if(!menu)return;


menu.innerHTML="";




menuOrder.forEach(function(id,index){



let item =
menuData.find(
x=>x.id===id
);



if(!item)return;



let a =
document.createElement("a");


a.className="menu-item";


a.href=item.url;


a.innerHTML=item.name;





// 当前页面高亮

let page =
location.pathname
.split("/")
.pop();



if(page===item.url){

a.classList.add("active");

}




// 拖动

a.draggable=true;



a.addEventListener(
"dragstart",
function(){

dragIndex=index;

});



a.addEventListener(
"dragover",
function(e){

e.preventDefault();

});



a.addEventListener(
"drop",
function(){


let target=index;


if(
dragIndex!==null &&
dragIndex!==target
){


let move =
menuOrder.splice(
dragIndex,
1
)[0];



menuOrder.splice(
target,
0,
move
);



saveMenu();


renderMenu();


}



});


menu.appendChild(a);



});


}







function saveMenu(){


localStorage.setItem(

"menuOrder",

JSON.stringify(menuOrder)

);


}







document.addEventListener(
"DOMContentLoaded",
function(){

renderMenu();

});