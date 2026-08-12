// =====================================================
// creator-admin.js
// 达人管理后台
//
// 功能：
// 1. 新增达人
// 2. 编辑达人
// 3. 单个删除
// 4. Handle筛选
// 5. 单个选择
// 6. 全选
// 7. 批量删除
// 8. 查看视频
// =====================================================

console.log("================================");
console.log("creator-admin.js 已成功加载");
console.log("版本：v7");
console.log("================================");


// =====================================================
// 全局数据
// =====================================================

let adminCreatorData = [];

let selectedCreatorIds = new Set();


// =====================================================
// 检查 Supabase
// =====================================================

function checkSupabase() {

    if (
        typeof supabaseClient === "undefined" ||
        !supabaseClient
    ) {

        console.error(
            "supabaseClient 不存在"
        );

        alert(
            "Supabase 连接失败，请刷新页面"
        );

        return false;
    }

    return true;
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
// JS 字符串安全处理
// =====================================================

function escapeJS(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n");
}


// =====================================================
// 添加达人
// =====================================================

async function addCreator() {

    console.log(
        "addCreator 开始执行"
    );


    if (
        !checkSupabase()
    ) {

        return;
    }


    const nameInput =
        document.getElementById(
            "creator-name"
        );

    const productInput =
        document.getElementById(
            "creator-product"
        );

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

    const sizeInput =
        document.getElementById(
            "creator-size"
        );

    const fitInput =
        document.getElementById(
            "creator-fit"
        );

    const videoInput =
        document.getElementById(
            "creator-video"
        );


    if (
        !nameInput ||
        !productInput ||
        !ftInput ||
        !inchInput ||
        !lbsInput ||
        !sizeInput ||
        !fitInput ||
        !videoInput
    ) {

        console.error(
            "达人管理页面存在找不到的输入框"
        );

        alert(
            "页面元素加载失败，请刷新页面"
        );

        return;
    }


    const name =
        nameInput.value.trim();

    const product =
        productInput.value.trim();

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

    const size =
        sizeInput.value.trim();

    const fit =
        fitInput.value.trim();

    const video =
        videoInput.value.trim();


    if (!name) {

        alert(
            "请输入达人名称"
        );

        nameInput.focus();

        return;
    }


    if (
        ft <= 0 &&
        inch <= 0
    ) {

        alert(
            "请输入达人身高"
        );

        ftInput.focus();

        return;
    }


    if (
        lbs <= 0
    ) {

        alert(
            "请输入达人体重"
        );

        lbsInput.focus();

        return;
    }


    if (!size) {

        alert(
            "请输入推荐尺码"
        );

        sizeInput.focus();

        return;
    }


    if (!video) {

        alert(
            "请输入 TikTok 视频链接"
        );

        videoInput.focus();

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


    const {
        data,
        error
    } = await supabaseClient

        .from("creators")

        .insert([
            {
                handle: name,
                product: product,
                height_ft: ft,
                height_in: inch,
                weight_lbs: lbs,
                height_cm: finalCm,
                weight_kg: finalKg,
                size: size,
                fit: fit,
                video_url: video
            }
        ])

        .select();


    if (error) {

        console.error(
            "达人保存失败:",
            error
        );


        const result =
            document.getElementById(
                "admin-result"
            );


        if (result) {

            result.innerHTML = `
                <span style="
                    color:#f53f3f;
                    font-weight:600;
                ">
                    ❌ 保存失败
                </span>

                <br>

                <span style="
                    color:#86909c;
                    font-size:13px;
                ">
                    ${escapeHTML(
                        error.message
                    )}
                </span>
            `;
        }

        return;
    }


    console.log(
        "达人保存成功:",
        data
    );


    const result =
        document.getElementById(
            "admin-result"
        );


    if (result) {

        result.innerHTML = `
            <span style="
                color:#00a870;
                font-weight:600;
            ">
                ✅ 达人保存成功
            </span>

            <br>

            ${escapeHTML(name)}

            <br>

            ${finalCm} cm / ${finalKg} kg
        `;
    }


    nameInput.value = "";
    productInput.value = "";
    ftInput.value = "";
    inchInput.value = "";
    lbsInput.value = "";
    sizeInput.value = "";
    fitInput.value = "";
    videoInput.value = "";


    await loadAdminCreators();
}


// =====================================================
// 读取达人
// =====================================================

async function loadAdminCreators() {

    console.log(
        "开始读取达人数据"
    );


    if (
        !checkSupabase()
    ) {

        return;
    }


    const list =
        document.getElementById(
            "adminCreatorList"
        );


    if (!list) {

        console.error(
            "找不到 adminCreatorList"
        );

        return;
    }


    const {
        data,
        error
    } = await supabaseClient

        .from("creators")

        .select("*");


    if (error) {

        console.error(
            "达人数据读取失败:",
            error
        );


        list.innerHTML = `
            <div class="creator-empty">

                ❌ 达人数据读取失败

                <br>

                <span>
                    ${escapeHTML(
                        error.message
                    )}
                </span>

            </div>
        `;

        return;
    }


    adminCreatorData =
        data || [];


    // =================================================
    // 清理已经不存在的选择
    // =================================================

    const existingIds =
        new Set(
            adminCreatorData.map(
                item =>
                    String(item.id)
            )
        );


    selectedCreatorIds =
        new Set(
            Array.from(
                selectedCreatorIds
            ).filter(
                id =>
                    existingIds.has(
                        String(id)
                    )
            )
        );


    if (
        adminCreatorData.length === 0
    ) {

        list.innerHTML = `
            <div class="creator-empty">

                👕 暂时还没有达人数据

                <br>

                <span>
                    可以先在上方添加达人
                </span>

            </div>
        `;


        updateSelectionUI();

        return;
    }


    renderAdminCreators();


    console.log(
        "达人数据读取成功:",
        adminCreatorData
    );
}


// =====================================================
// 获取当前筛选后的达人
// =====================================================

function getFilteredCreators() {

    const filterInput =
        document.getElementById(
            "creatorHandleFilter"
        );


    const keyword =
        filterInput
            ? filterInput.value
                .trim()
                .toLowerCase()
            : "";


    if (!keyword) {

        return adminCreatorData;
    }


    return adminCreatorData.filter(
        item => {

            const handle =
                String(
                    item.handle || ""
                )
                    .trim()
                    .toLowerCase();


            return handle.includes(
                keyword
            );
        }
    );
}


// =====================================================
// 筛选达人
// =====================================================

function filterCreators() {

    console.log(
        "执行达人筛选"
    );

    renderAdminCreators();
}


// =====================================================
// 创建达人卡片
// =====================================================

function createCreatorCard(item) {

    const id =
        String(
            item.id || ""
        );


    const safeId =
        escapeJS(id);


    const checked =
        selectedCreatorIds.has(id);


    let videoButton = "";


    if (
        item.video_url
    ) {

        videoButton = `
            <button
                class="video-btn"
                type="button"
                onclick="openAdminVideo('${escapeJS(
                    item.video_url
                )}')"
            >
                🎬 查看达人视频
            </button>
        `;

    } else {

        videoButton = `
            <button
                class="
                    video-btn
                    video-disabled
                "
                type="button"
                disabled
            >
                暂无达人视频
            </button>
        `;
    }


    return `
        <div
            class="creator-card"
            id="creator-card-${escapeHTML(id)}"
            style="
                position:relative;
            "
        >

            <!-- =====================
            选择框
            ====================== -->

            <div
                style="
                    position:absolute;
                    top:14px;
                    left:14px;
                    z-index:10;
                "
            >

                <label
                    style="
                        display:flex;
                        align-items:center;
                        cursor:pointer;
                    "
                    title="选择达人"
                >

                    <input
                        type="checkbox"
                        class="creator-select-checkbox"
                        data-id="${escapeHTML(id)}"
                        ${checked ? "checked" : ""}
                        onchange="toggleCreatorSelection('${safeId}')"
                        style="
                            width:18px;
                            height:18px;
                            cursor:pointer;
                            accent-color:#1677ff;
                        "
                    >

                </label>

            </div>


            <!-- =====================
            右上角操作按钮
            ====================== -->

            <div
                style="
                    position:absolute;
                    top:12px;
                    right:12px;
                    display:flex;
                    gap:8px;
                    z-index:5;
                "
            >

                <button
                    type="button"
                    class="admin-edit-btn"
                    onclick="editCreator('${safeId}')"
                    title="编辑达人"
                    style="
                        border:0;
                        background:#e8f3ff;
                        color:#1677ff;
                        width:34px;
                        height:34px;
                        border-radius:8px;
                        cursor:pointer;
                        font-size:15px;
                    "
                >
                    ✏️
                </button>


                <button
                    type="button"
                    class="admin-delete-btn"
                    onclick="deleteCreator('${safeId}')"
                    title="删除达人"
                >
                    🗑
                </button>

            </div>


            <!-- =====================
            卡片顶部
            ====================== -->

            <div
                class="creator-top"
                style="
                    padding-left:35px;
                "
            >

                <div class="creator-avatar">
                    👕
                </div>


                <div class="creator-title">

                    <h3>
                        ${escapeHTML(
                            item.handle ||
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


            <!-- =====================
            身高体重
            ====================== -->

            <div class="creator-body">

                <div class="creator-stat">

                    <span class="stat-label">
                        身高
                    </span>

                    <strong>
                        ${
                            item.height_cm ??
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
                            item.weight_kg ??
                            "--"
                        }
                        kg
                    </strong>

                </div>

            </div>


            <!-- =====================
            推荐尺码
            ====================== -->

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


            <!-- =====================
            穿着效果
            ====================== -->

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


            <!-- =====================
            视频
            ====================== -->

            ${videoButton}

        </div>
    `;
}


// =====================================================
// 渲染达人列表
// =====================================================

function renderAdminCreators() {

    const list =
        document.getElementById(
            "adminCreatorList"
        );


    if (!list) {

        return;
    }


    const filteredData =
        getFilteredCreators();


    if (
        filteredData.length === 0
    ) {

        list.innerHTML = `
            <div
                style="
                    padding:40px;
                    text-align:center;
                    color:#86909c;
                "
            >

                🔍 没有找到匹配的达人

            </div>
        `;


        updateSelectionUI();

        return;
    }


    list.innerHTML =
        filteredData
            .map(
                item =>
                    createCreatorCard(item)
            )
            .join("");


    updateSelectionUI();
}


// =====================================================
// 单个选择 / 取消选择
// =====================================================

function toggleCreatorSelection(id) {

    const creatorId =
        String(id);


    if (
        selectedCreatorIds.has(
            creatorId
        )
    ) {

        selectedCreatorIds.delete(
            creatorId
        );

    } else {

        selectedCreatorIds.add(
            creatorId
        );
    }


    console.log(
        "当前已选择达人:",
        Array.from(
            selectedCreatorIds
        )
    );


    updateSelectionUI();
}


// =====================================================
// 全选 / 取消全选
//
// 只作用于当前筛选出来的达人
// =====================================================

function toggleSelectAll() {

    const filteredData =
        getFilteredCreators();


    if (
        filteredData.length === 0
    ) {

        return;
    }


    const filteredIds =
        filteredData.map(
            item =>
                String(item.id)
        );


    const allSelected =
        filteredIds.every(
            id =>
                selectedCreatorIds.has(id)
        );


    if (
        allSelected
    ) {

        filteredIds.forEach(
            id => {

                selectedCreatorIds.delete(
                    id
                );

            }
        );

    } else {

        filteredIds.forEach(
            id => {

                selectedCreatorIds.add(
                    id
                );

            }
        );
    }


    renderAdminCreators();
}


// =====================================================
// 更新顶部选择状态
// =====================================================

function updateSelectionUI() {

    // =================================================
    // 你的 HTML 实际使用的是：
    //
    // selectedCreatorCount
    // batchDeleteCreatorsBtn
    // selectAllCreators
    //
    // 这里严格按照 HTML 来
    // =================================================


    const selectedCountElement =
        document.getElementById(
            "selectedCreatorCount"
        );


    const batchDeleteBtn =
        document.getElementById(
            "batchDeleteCreatorsBtn"
        );


    const selectAllCheckbox =
        document.getElementById(
            "selectAllCreators"
        );


    const selectedCount =
        selectedCreatorIds.size;


    const filteredData =
        getFilteredCreators();


    const filteredIds =
        filteredData.map(
            item =>
                String(item.id)
        );


    const allFilteredSelected =
        filteredIds.length > 0 &&
        filteredIds.every(
            id =>
                selectedCreatorIds.has(id)
        );


    const someFilteredSelected =
        filteredIds.some(
            id =>
                selectedCreatorIds.has(id)
        );


    // =================================================
    // 更新已选择数量
    // =================================================

    if (
        selectedCountElement
    ) {

        selectedCountElement.innerHTML =
            `已选择 ${selectedCount} 个`;
    }


    // =================================================
    // 更新批量删除按钮
    // =================================================

    if (
        batchDeleteBtn
    ) {

        batchDeleteBtn.disabled =
            selectedCount === 0;


        batchDeleteBtn.style.opacity =
            selectedCount === 0
                ? "0.55"
                : "1";


        batchDeleteBtn.style.cursor =
            selectedCount === 0
                ? "not-allowed"
                : "pointer";


        batchDeleteBtn.innerText =
            selectedCount > 0
                ? `🗑️ 批量删除 ${selectedCount} 个`
                : "🗑️ 批量删除";
    }


    // =================================================
    // 更新全选框
    // =================================================

    if (
        selectAllCheckbox
    ) {

        selectAllCheckbox.checked =
            allFilteredSelected;


        selectAllCheckbox.indeterminate =
            !allFilteredSelected &&
            someFilteredSelected;
    }
}


// =====================================================
// 批量删除达人
// =====================================================

async function batchDeleteCreators() {

    const selectedIds =
        Array.from(
            selectedCreatorIds
        );


    if (
        selectedIds.length === 0
    ) {

        alert(
            "请先选择要删除的达人"
        );

        return;
    }


    const selectedCreators =
        adminCreatorData.filter(
            item =>
                selectedIds.includes(
                    String(item.id)
                )
        );


    const previewNames =
        selectedCreators
            .slice(0, 8)
            .map(
                item =>
                    item.handle ||
                    "未命名达人"
            );


    let confirmText =
        `确定要删除选中的 ${selectedIds.length} 个达人吗？\n\n`;


    if (
        previewNames.length > 0
    ) {

        confirmText +=
            previewNames.join("\n");
    }


    if (
        selectedIds.length > 8
    ) {

        confirmText +=
            `\n……以及其他 ${
                selectedIds.length - 8
            } 个达人`;
    }


    confirmText +=
        "\n\n删除后无法恢复，请确认。";


    const confirmed =
        confirm(
            confirmText
        );


    if (!confirmed) {

        return;
    }


    if (
        !checkSupabase()
    ) {

        return;
    }


    const batchDeleteBtn =
        document.getElementById(
            "batchDeleteCreatorsBtn"
        );


    if (
        batchDeleteBtn
    ) {

        batchDeleteBtn.disabled =
            true;

        batchDeleteBtn.innerText =
            "⏳ 正在删除...";
    }


    console.log(
        "开始批量删除达人:",
        selectedIds
    );


    const {
        error
    } = await supabaseClient

        .from("creators")

        .delete()

        .in(
            "id",
            selectedIds
        );


    if (error) {

        console.error(
            "批量删除失败:",
            error
        );


        if (
            batchDeleteBtn
        ) {

            batchDeleteBtn.disabled =
                false;
        }


        alert(
            "批量删除失败：" +
            error.message
        );

        return;
    }


    console.log(
        "批量删除成功:",
        selectedIds
    );


    selectedCreatorIds =
        new Set();


    const result =
        document.getElementById(
            "admin-result"
        );


    if (
        result
    ) {

        result.innerHTML = `
            <span
                style="
                    color:#00a870;
                    font-weight:600;
                "
            >
                ✅ 批量删除成功
            </span>

            <br>

            已删除
            <strong>
                ${selectedIds.length}
            </strong>
            个达人
        `;
    }


    await loadAdminCreators();
}


// =====================================================
// 编辑达人
// =====================================================

async function editCreator(id) {

    if (!id) {

        return;
    }


    console.log(
        "开始编辑达人:",
        id
    );


    if (
        !checkSupabase()
    ) {

        return;
    }


    const {
        data,
        error
    } = await supabaseClient

        .from("creators")

        .select("*")

        .eq(
            "id",
            id
        )

        .single();


    if (error) {

        console.error(
            "读取达人失败:",
            error
        );

        alert(
            "读取达人失败：" +
            error.message
        );

        return;
    }


    if (!data) {

        alert(
            "没有找到这个达人"
        );

        return;
    }


    const card =
        document.getElementById(
            "creator-card-" + id
        );


    if (!card) {

        return;
    }


    const ft =
        data.height_ft !== null &&
        data.height_ft !== undefined
            ? data.height_ft
            : "";


    const inch =
        data.height_in !== null &&
        data.height_in !== undefined
            ? data.height_in
            : "";


    const lbs =
        data.weight_lbs !== null &&
        data.weight_lbs !== undefined
            ? data.weight_lbs
            : "";


    card.innerHTML = `

        <div
            style="
                padding:20px;
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:18px;
                "
            >

                <h3
                    style="
                        margin:0;
                        font-size:18px;
                    "
                >
                    ✏️ 编辑达人
                </h3>


                <button
                    type="button"
                    onclick="loadAdminCreators()"
                    style="
                        border:0;
                        background:#f2f3f5;
                        color:#4e5969;
                        padding:7px 12px;
                        border-radius:7px;
                        cursor:pointer;
                    "
                >
                    取消
                </button>

            </div>


            <div
                style="
                    margin-bottom:12px;
                "
            >

                <label>
                    达人名称
                </label>

                <input
                    id="edit-name-${escapeHTML(id)}"
                    type="text"
                    value="${escapeHTML(
                        data.handle || ""
                    )}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    margin-bottom:12px;
                "
            >

                <label>
                    产品
                </label>

                <input
                    id="edit-product-${escapeHTML(id)}"
                    type="text"
                    value="${escapeHTML(
                        data.product || ""
                    )}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:12px;
                    margin-bottom:12px;
                "
            >

                <div>

                    <label>
                        Height Feet
                    </label>

                    <input
                        id="edit-ft-${escapeHTML(id)}"
                        type="number"
                        value="${escapeHTML(ft)}"
                        style="
                            width:100%;
                            box-sizing:border-box;
                            margin-top:6px;
                        "
                    >

                </div>


                <div>

                    <label>
                        Height Inch
                    </label>

                    <input
                        id="edit-inch-${escapeHTML(id)}"
                        type="number"
                        value="${escapeHTML(inch)}"
                        style="
                            width:100%;
                            box-sizing:border-box;
                            margin-top:6px;
                        "
                    >

                </div>

            </div>


            <div
                style="
                    margin-bottom:12px;
                "
            >

                <label>
                    Weight lbs
                </label>

                <input
                    id="edit-lbs-${escapeHTML(id)}"
                    type="number"
                    value="${escapeHTML(lbs)}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    margin-bottom:12px;
                "
            >

                <label>
                    推荐尺码
                </label>

                <input
                    id="edit-size-${escapeHTML(id)}"
                    type="text"
                    value="${escapeHTML(
                        data.size || ""
                    )}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    margin-bottom:12px;
                "
            >

                <label>
                    穿着效果
                </label>

                <input
                    id="edit-fit-${escapeHTML(id)}"
                    type="text"
                    value="${escapeHTML(
                        data.fit || ""
                    )}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <div
                style="
                    margin-bottom:18px;
                "
            >

                <label>
                    TikTok视频链接
                </label>

                <input
                    id="edit-video-${escapeHTML(id)}"
                    type="text"
                    value="${escapeHTML(
                        data.video_url || ""
                    )}"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-top:6px;
                    "
                >

            </div>


            <button
                type="button"
                class="calculate-btn"
                onclick="saveCreatorEdit('${safeIdForAttribute(id)}')"
                style="
                    width:100%;
                "
            >
                💾 保存修改
            </button>

        </div>

    `;
}


// =====================================================
// 编辑ID安全处理
// =====================================================

function safeIdForAttribute(id) {

    return escapeJS(
        String(id)
    );
}


// =====================================================
// 保存达人编辑
// =====================================================

async function saveCreatorEdit(id) {

    console.log(
        "保存达人修改:",
        id
    );


    if (!id) {

        return;
    }


    if (
        !checkSupabase()
    ) {

        return;
    }


    const nameInput =
        document.getElementById(
            "edit-name-" + id
        );

    const productInput =
        document.getElementById(
            "edit-product-" + id
        );

    const ftInput =
        document.getElementById(
            "edit-ft-" + id
        );

    const inchInput =
        document.getElementById(
            "edit-inch-" + id
        );

    const lbsInput =
        document.getElementById(
            "edit-lbs-" + id
        );

    const sizeInput =
        document.getElementById(
            "edit-size-" + id
        );

    const fitInput =
        document.getElementById(
            "edit-fit-" + id
        );

    const videoInput =
        document.getElementById(
            "edit-video-" + id
        );


    if (
        !nameInput ||
        !productInput ||
        !ftInput ||
        !inchInput ||
        !lbsInput ||
        !sizeInput ||
        !fitInput ||
        !videoInput
    ) {

        alert(
            "编辑框加载失败，请重新点击编辑"
        );

        return;
    }


    const name =
        nameInput.value.trim();

    const product =
        productInput.value.trim();

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

    const size =
        sizeInput.value.trim();

    const fit =
        fitInput.value.trim();

    const video =
        videoInput.value.trim();


    if (!name) {

        alert(
            "请输入达人名称"
        );

        nameInput.focus();

        return;
    }


    if (
        ft <= 0 &&
        inch <= 0
    ) {

        alert(
            "请输入达人身高"
        );

        ftInput.focus();

        return;
    }


    if (
        lbs <= 0
    ) {

        alert(
            "请输入达人体重"
        );

        lbsInput.focus();

        return;
    }


    if (!size) {

        alert(
            "请输入推荐尺码"
        );

        sizeInput.focus();

        return;
    }


    if (!video) {

        alert(
            "请输入 TikTok 视频链接"
        );

        videoInput.focus();

        return;
    }


    const cm =
        ft * 30.48 +
        inch * 2.54;


    const finalCm =
        Number(
            cm.toFixed(1)
        );


    const kg =
        lbs * 0.453592;


    const finalKg =
        Number(
            kg.toFixed(1)
        );


    const {
        data,
        error
    } = await supabaseClient

        .from("creators")

        .update({
            handle: name,
            product: product,
            height_ft: ft,
            height_in: inch,
            weight_lbs: lbs,
            height_cm: finalCm,
            weight_kg: finalKg,
            size: size,
            fit: fit,
            video_url: video
        })

        .eq(
            "id",
            id
        )

        .select();


    if (error) {

        console.error(
            "达人修改失败:",
            error
        );


        alert(
            "保存修改失败：" +
            error.message
        );

        return;
    }


    console.log(
        "达人修改成功:",
        data
    );


    const result =
        document.getElementById(
            "admin-result"
        );


    if (result) {

        result.innerHTML = `
            <span
                style="
                    color:#00a870;
                    font-weight:600;
                "
            >
                ✅ 达人修改成功
            </span>

            <br>

            ${escapeHTML(name)}
        `;
    }


    await loadAdminCreators();
}


// =====================================================
// 删除单个达人
// =====================================================

async function deleteCreator(id) {

    if (!id) {

        return;
    }


    const creator =
        adminCreatorData.find(
            item =>
                String(item.id) ===
                String(id)
        );


    const creatorName =
        creator &&
        creator.handle
            ? creator.handle
            : "这个达人";


    const confirmDelete =
        confirm(
            `确定要删除达人「${creatorName}」吗？\n\n删除后无法恢复。`
        );


    if (!confirmDelete) {

        return;
    }


    if (
        !checkSupabase()
    ) {

        return;
    }


    const {
        error
    } = await supabaseClient

        .from("creators")

        .delete()

        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "删除失败:",
            error
        );


        alert(
            "删除失败：" +
            error.message
        );

        return;
    }


    console.log(
        "达人删除成功:",
        id
    );


    selectedCreatorIds.delete(
        String(id)
    );


    const result =
        document.getElementById(
            "admin-result"
        );


    if (result) {

        result.innerHTML = `
            <span
                style="
                    color:#00a870;
                    font-weight:600;
                "
            >
                ✅ 达人已删除
            </span>
        `;
    }


    await loadAdminCreators();
}


// =====================================================
// 打开达人视频
// =====================================================

function openAdminVideo(url) {

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
// 搜索按钮
// =====================================================

function setupCreatorFilter() {

    const filterInput =
        document.getElementById(
            "creatorHandleFilter"
        );


    const searchButton =
        document.getElementById(
            "creatorSearchBtn"
        );


    const clearButton =
        document.getElementById(
            "creatorClearFilterBtn"
        );


    const selectAllCheckbox =
        document.getElementById(
            "selectAllCreators"
        );


    const batchDeleteButton =
        document.getElementById(
            "batchDeleteCreatorsBtn"
        );


    // =================================================
    // 搜索
    // =================================================

    if (
        searchButton
    ) {

        searchButton.addEventListener(
            "click",
            function () {

                filterCreators();

            }
        );
    }


    // =================================================
    // 输入框回车搜索
    // =================================================

    if (
        filterInput
    ) {

        filterInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    filterCreators();
                }
            }
        );
    }


    // =================================================
    // 输入时实时筛选
    // =================================================

    if (
        filterInput
    ) {

        filterInput.addEventListener(
            "input",
            function () {

                filterCreators();

            }
        );
    }


    // =================================================
    // 清空筛选
    // =================================================

    if (
        clearButton
    ) {

        clearButton.addEventListener(
            "click",
            function () {

                if (
                    filterInput
                ) {

                    filterInput.value = "";
                }


                filterCreators();

            }
        );
    }


    // =================================================
    // 全选
    // =================================================

    if (
        selectAllCheckbox
    ) {

        selectAllCheckbox.addEventListener(
            "change",
            function () {

                toggleSelectAll();

            }
        );
    }


    // =================================================
    // 批量删除
    // =================================================

    if (
        batchDeleteButton
    ) {

        batchDeleteButton.addEventListener(
            "click",
            function () {

                batchDeleteCreators();

            }
        );
    }


    // =================================================
    // 初始更新
    // =================================================

    updateSelectionUI();
}


// =====================================================
// 页面加载
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "达人管理页面加载完成"
        );


        setupCreatorFilter();


        setTimeout(
            function () {

                loadAdminCreators();

            },
            300
        );

    }
);


// =====================================================
// 全局函数
// 防止 HTML onclick 找不到
// =====================================================

window.addCreator =
    addCreator;

window.loadAdminCreators =
    loadAdminCreators;

window.filterCreators =
    filterCreators;

window.toggleCreatorSelection =
    toggleCreatorSelection;

window.toggleSelectAll =
    toggleSelectAll;

window.batchDeleteCreators =
    batchDeleteCreators;

window.editCreator =
    editCreator;

window.saveCreatorEdit =
    saveCreatorEdit;

window.deleteCreator =
    deleteCreator;

window.openAdminVideo =
    openAdminVideo;


console.log(
    "creator-admin.js 所有函数加载完成"
);