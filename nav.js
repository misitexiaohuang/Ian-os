const menuData = [


    {
        id:"home",
        name:"🏠 首页",
        url:"index.html"
    },


    {
        id:"shop-data",
        name:"📊 店铺数据分析",
        url:"shop-data.html"
    },


    {
    id:"size-helper",
    name:"👕 尺码助手",
    url:"size-helper.html"
    },


    {
        id:"creator-admin",
        name:"🧑‍💻 达人尺码管理",
        url:"creator-admin.html"
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


// =====================================================
// 读取保存顺序
// =====================================================

let menuOrder =
    JSON.parse(
        localStorage.getItem("menuOrder")
    );


// =====================================================
// 如果没有保存
// 使用默认顺序
// =====================================================

if(!Array.isArray(menuOrder)){

    menuOrder =
        menuData.map(
            item => item.id
        );

}


// =====================================================
// 自动补充新增菜单
// =====================================================

menuData.forEach(item => {

    if(!menuOrder.includes(item.id)){

        menuOrder.push(item.id);

    }

});


// =====================================================
// 清理不存在的旧菜单
// =====================================================

menuOrder =
    menuOrder.filter(id => {

        return menuData.some(
            item => item.id === id
        );

    });


// =====================================================
// 拖动状态
// =====================================================

let dragIndex = null;

let dragItem = null;

let dropIndex = null;


// =====================================================
// 创建拖动占位线
// =====================================================

function createDropLine(){

    let line =
        document.createElement("div");


    line.className =
        "nav-drop-line";


    line.style.height = "3px";

    line.style.background = "#1677ff";

    line.style.borderRadius = "3px";

    line.style.margin = "4px 8px";


    return line;

}


// =====================================================
// 清除拖动提示
// =====================================================

function clearDragIndicator(){

    document
        .querySelectorAll(".nav-drop-line")
        .forEach(function(line){

            line.remove();

        });


    document
        .querySelectorAll(".menu-item")
        .forEach(function(item){

            item.style.opacity = "";

        });

}


// =====================================================
// 显示预计落地位置
// =====================================================

function showDropIndicator(targetElement, after){

    clearDragIndicator();


    let line =
        createDropLine();


    if(after){

        targetElement
            .parentNode
            .insertBefore(
                line,
                targetElement.nextSibling
            );

    }else{

        targetElement
            .parentNode
            .insertBefore(
                line,
                targetElement
            );

    }

}


// =====================================================
// 渲染导航
// =====================================================

function renderMenu(){


    let menu =
        document.getElementById("menu");


    if(!menu){

        return;

    }


    menu.innerHTML = "";


    menuOrder.forEach(
        function(id,index){


            let item =
                menuData.find(
                    x => x.id === id
                );


            if(!item){

                return;

            }


            let a =
                document.createElement("a");


            a.className =
                "menu-item";


            a.href =
                item.url;


            a.innerHTML =
                item.name;


            // =================================================
            // 当前页面高亮
            // =================================================

            let page =
                location.pathname
                    .split("/")
                    .pop();


            if(page === item.url){

                a.classList.add(
                    "active"
                );

            }


            // =================================================
            // 开启拖动
            // =================================================

            a.draggable = true;


            // =================================================
            // 开始拖动
            // =================================================

            a.addEventListener(
                "dragstart",
                function(e){

                    dragIndex = index;

                    dragItem = a;


                    // 浏览器拖动效果

                    try{

                        e.dataTransfer.effectAllowed =
                            "move";

                    }catch(error){}


                    // 当前被拖动的项目变淡

                    setTimeout(
                        function(){

                            if(dragItem){

                                dragItem.style.opacity =
                                    "0.45";

                            }

                        },
                        0
                    );

                }
            );


            // =================================================
            // 拖动经过
            // =================================================

            a.addEventListener(
                "dragover",
                function(e){

                    e.preventDefault();


                    if(
                        dragIndex === null ||
                        dragIndex === index
                    ){

                        return;

                    }


                    // 鼠标在当前菜单项目的什么位置

                    let rect =
                        a.getBoundingClientRect();


                    let middle =
                        rect.top +
                        rect.height / 2;


                    let after =
                        e.clientY > middle;


                    // 保存预计落地位置

                    dropIndex = index;


                    showDropIndicator(
                        a,
                        after
                    );

                }
            );


            // =================================================
            // 拖动离开
            // =================================================

            a.addEventListener(
                "dragleave",
                function(){

                    /*
                     * 这里不立即删除线。
                     *
                     * 因为 dragleave 在浏览器里
                     * 很容易频繁触发。
                     *
                     * 下一次 dragover 会自动更新。
                     */

                }
            );


            // =================================================
            // 松手
            // =================================================

            a.addEventListener(
                "drop",
                function(e){

                    e.preventDefault();


                    if(
                        dragIndex === null ||
                        dragIndex === index
                    ){

                        clearDragIndicator();

                        return;

                    }


                    let target =
                        index;


                    // =================================================
                    // 判断放在目标前面还是后面
                    // =================================================

                    let rect =
                        a.getBoundingClientRect();


                    let middle =
                        rect.top +
                        rect.height / 2;


                    let after =
                        e.clientY > middle;


                    // =================================================
                    // 取出原来的菜单
                    // =================================================

                    let move =
                        menuOrder.splice(
                            dragIndex,
                            1
                        )[0];


                    // =================================================
                    // 计算真正插入位置
                    // =================================================

                    if(after){

                        /*
                         * 如果原来的项目在目标之前，
                         * 删除后目标索引会自动减 1。
                         */

                        if(dragIndex < target){

                            target--;

                        }


                        target++;

                    }else{

                        if(dragIndex < target){

                            target--;

                        }

                    }


                    // 防止越界

                    if(target < 0){

                        target = 0;

                    }


                    if(
                        target >
                        menuOrder.length
                    ){

                        target =
                            menuOrder.length;

                    }


                    // =================================================
                    // 插入新位置
                    // =================================================

                    menuOrder.splice(
                        target,
                        0,
                        move
                    );


                    // =================================================
                    // 保存
                    // =================================================

                    saveMenu();


                    // =================================================
                    // 清除提示
                    // =================================================

                    clearDragIndicator();


                    dragIndex = null;

                    dragItem = null;

                    dropIndex = null;


                    // =================================================
                    // 重新渲染
                    // =================================================

                    renderMenu();

                }
            );


            // =================================================
            // 拖动结束
            // =================================================

            a.addEventListener(
                "dragend",
                function(){

                    clearDragIndicator();


                    dragIndex = null;

                    dragItem = null;

                    dropIndex = null;

                }
            );


            menu.appendChild(a);

        }
    );

}


// =====================================================
// 保存菜单顺序
// =====================================================

function saveMenu(){

    localStorage.setItem(
        "menuOrder",
        JSON.stringify(menuOrder)
    );

}


// =====================================================
// 页面加载
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderMenu();

    }
);