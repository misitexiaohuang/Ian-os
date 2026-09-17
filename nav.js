/* =========================================================
   Ian OS - 全局导航
========================================================= */

const menuData = [
  {
    id: "home",
    name: "🏠 首页",
    url: "index.html"
  },
  {
    id: "shop-data",
    name: "📊 店铺数据分析",
    url: "shop-data.html"
  },
  {
    id: "sales",
    name: "📈 销量数据",
    url: "sales.html"
  },
  {
    id: "size-helper",
    name: "👕 尺码助手",
    url: "size-helper.html"
  },
  {
    id: "creator-admin",
    name: "🧑‍💻 达人尺码管理",
    url: "creator-admin.html"
  },
  {
    id: "commission",
    name: "💰 当月TC预估",
    url: "commission.html"
  },
  {
    id: "destroy",
    name: "🗑️ 销毁费用预估",
    url: "destroy.html"
  },
  {
    id: "sample",
    name: "📦 寄样审核",
    url: "sample.html"
  }
];


/* =========================================================
   DOM
========================================================= */

const menuElement = document.getElementById("menu");


/* =========================================================
   LocalStorage
========================================================= */

const MENU_ORDER_KEY = "ian-os-menu-order";


/* =========================================================
   读取用户保存的菜单顺序
========================================================= */

function getSavedOrder() {

  try {

    const saved =
      localStorage.getItem(MENU_ORDER_KEY);

    if (!saved) {
      return null;
    }

    const parsed =
      JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed;

  } catch (error) {

    console.error(
      "读取菜单排序失败:",
      error
    );

    return null;
  }
}


/* =========================================================
   保存菜单顺序
========================================================= */

function saveMenuOrder() {

  if (!menuElement) {
    return;
  }

  const items =
    [...menuElement.querySelectorAll(".menu-item")];

  const order =
    items.map(item => item.dataset.id);

  localStorage.setItem(
    MENU_ORDER_KEY,
    JSON.stringify(order)
  );
}


/* =========================================================
   判断当前页面
========================================================= */

function isCurrentPage(url) {

  const currentPath =
    window.location.pathname;

  const currentFile =
    currentPath.split("/").pop();

  if (!currentFile) {

    return url === "index.html";
  }

  return currentFile === url;
}


/* =========================================================
   渲染导航
========================================================= */

function renderMenu() {

  if (!menuElement) {
    return;
  }

  menuElement.innerHTML = "";


  /* -----------------------------------------
     默认菜单顺序
  ----------------------------------------- */

  let orderedMenu =
    [...menuData];


  /* -----------------------------------------
     读取用户保存的排序
  ----------------------------------------- */

  const savedOrder =
    getSavedOrder();


  if (savedOrder) {

    const orderMap =
      new Map();

    savedOrder.forEach(
      (id, index) => {

        orderMap.set(
          id,
          index
        );

      }
    );


    orderedMenu.sort(
      (a, b) => {

        const aIndex =
          orderMap.has(a.id)
            ? orderMap.get(a.id)
            : 9999;

        const bIndex =
          orderMap.has(b.id)
            ? orderMap.get(b.id)
            : 9999;

        return aIndex - bIndex;
      }
    );
  }


  /* -----------------------------------------
     创建菜单
  ----------------------------------------- */

  orderedMenu.forEach(item => {

    const link =
      document.createElement("a");

    link.href =
      item.url;

    link.className =
      "menu-item";

    link.dataset.id =
      item.id;

    link.draggable =
      true;

    link.textContent =
      item.name;


    /* 当前页面高亮 */

    if (isCurrentPage(item.url)) {

      link.classList.add(
        "active"
      );
    }


    menuElement.appendChild(
      link
    );

  });


  /* -----------------------------------------
     启用拖拽排序
  ----------------------------------------- */

  enableDragAndDrop();
}


/* =========================================================
   拖拽排序
========================================================= */

function enableDragAndDrop() {

  if (!menuElement) {
    return;
  }

  const items =
    [
      ...menuElement.querySelectorAll(
        ".menu-item"
      )
    ];

  let draggedItem =
    null;


  items.forEach(item => {


    /* -----------------------------------------
       开始拖拽
    ----------------------------------------- */

    item.addEventListener(
      "dragstart",
      event => {

        draggedItem =
          item;

        item.classList.add(
          "dragging"
        );

        event.dataTransfer.effectAllowed =
          "move";
      }
    );


    /* -----------------------------------------
       拖拽结束
    ----------------------------------------- */

    item.addEventListener(
      "dragend",
      () => {

        item.classList.remove(
          "dragging"
        );

        draggedItem =
          null;

        saveMenuOrder();
      }
    );


    /* -----------------------------------------
       拖拽经过
    ----------------------------------------- */

    item.addEventListener(
      "dragover",
      event => {

        event.preventDefault();


        if (
          !draggedItem ||
          draggedItem === item
        ) {

          return;
        }


        const rect =
          item.getBoundingClientRect();

        const middle =
          rect.top +
          rect.height / 2;


        if (
          event.clientY <
          middle
        ) {

          menuElement.insertBefore(
            draggedItem,
            item
          );

        } else {

          menuElement.insertBefore(
            draggedItem,
            item.nextSibling
          );
        }

      }
    );

  });

}


/* =========================================================
   初始化
========================================================= */

renderMenu();