// =====================================================
// supabase.js
// Supabase 数据库连接
// =====================================================

console.log("================================");
console.log("supabase.js 开始加载");
console.log("================================");


// =====================================================
// Supabase 配置
// =====================================================

const SUPABASE_URL =
    "https://zvccsktjbgizsjjyjnuh.supabase.co";


const SUPABASE_KEY =
    "sb_publishable_n30eX-JH48Z6XKzR4HXPEg_v-uFgWoE";


// =====================================================
// 检查 Supabase 官方库
// =====================================================

if (
    typeof supabase === "undefined"
) {

    console.error(
        "❌ Supabase 官方 JS 库没有加载"
    );

} else {


    // =================================================
    // 创建 Supabase 连接
    // =================================================

    const supabaseClient =
        supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );


    // =================================================
    // 暴露给其他 JS 文件
    // =================================================

    window.supabaseClient =
        supabaseClient;


    console.log(
        "✅ Supabase 连接创建成功"
    );

    console.log(
        "supabaseClient:",
        window.supabaseClient
    );

}


console.log(
    "supabase.js 加载完成"
);