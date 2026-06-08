const STORE_KEY = "tea-rd-v3-state";
const SETTINGS_KEY = "tea-rd-v3-settings";
const API_ENABLED = !window.FORCE_LOCAL_MODE && location.protocol !== "file:";

const defaultSettings = {
  teaPrimaryCategories: ["绿茶", "红茶", "乌龙茶", "黄茶", "白茶", "黑茶", "花茶", "其他代用茶"],
  additiveCategories: ["香原料", "其他"],
  generalCategories: ["乳制品", "果汁果酱", "其他"],
  materialCategories: ["茶叶", "果汁", "乳制品", "糖浆", "小料", "添加剂", "包装物", "其它"],
  owners: ["原料组", "茶底组", "研发组", "风味组", "试产组", "生产组", "品控组"],
  statuses: ["研发中", "已定版", "已归档"],
  materialTags: ["红茶", "乌龙", "绿茶", "白茶", "花香", "高香", "奶茶", "果茶", "待评审"],
  blendTags: ["奶茶茶底", "果茶茶底", "冷萃茶底", "高香型", "厚度型", "标准版", "待评审"],
  formulaTags: ["奶茶", "果茶", "冷萃", "厚乳", "季节新品", "标准版", "待评审"],
  units: ["kg", "g", "L", "ml", "%"],
};

const defaultState = {
  materials: [
    {
      id: "MAT-20260524-001",
      name: "云南大叶种红茶",
      materialGroup: "tea",
      category: "茶叶",
      primaryCategory: "红茶",
      secondaryCategory: "大叶种红茶",
      owner: "原料组",
      status: "已定版",
      tag: "红茶",
      origin: "云南临沧",
      style: "蜜香、厚度高",
      spec: "一级碎茶，水分 5.8%",
      cost: "86 元/kg",
      note: "蜜香明显，适合奶茶和果茶茶底。",
      createdAt: "2026-05-24",
    },
    {
      id: "MAT-20260524-002",
      name: "武夷岩茶轻焙",
      materialGroup: "tea",
      category: "茶叶",
      primaryCategory: "乌龙茶",
      secondaryCategory: "岩茶",
      owner: "原料组",
      status: "研发中",
      tag: "乌龙",
      origin: "福建武夷山",
      style: "轻焙火、尾韵长",
      spec: "轻焙条索，水分 4.9%",
      cost: "142 元/kg",
      note: "焙火香稳定，尾韵较长。",
      createdAt: "2026-05-24",
    },
    {
      id: "MAT-20260524-003",
      name: "白桃浓缩汁",
      materialGroup: "general",
      category: "果汁果酱",
      generalCategory: "果汁果酱",
      supplier: "山东供应商",
      owner: "风味组",
      status: "已定版",
      tag: "果茶",
      origin: "山东",
      style: "白桃香前置",
      spec: "65 Brix，冷藏",
      cost: "29 元/kg",
      note: "非茶叶原料，成品配方中可手动录入，暂不参与调用统计。",
      createdAt: "2026-05-24",
    },
  ],
  blends: [
    {
      id: "BLD-20260524-001",
      name: "蜜香红茶奶茶底",
      customer: "内部测试",
      owner: "茶底组",
      status: "已定版",
      tag: "奶茶茶底",
      version: "v1.0",
      items: [{ materialId: "MAT-20260524-001", name: "云南大叶种红茶", ratio: 100 }],
      method: "常规干拼",
      note: "门店常规奶茶茶底。",
      createdAt: "2026-05-24",
    },
  ],
  formulas: [
    {
      id: "FRM-20260524-001",
      name: "厚乳蜜香红茶",
      owner: "研发组",
      status: "研发中",
      tag: "奶茶",
      version: "v0.1",
      blendId: "BLD-20260524-001",
      blendRatio: 62,
      teaMaterialId: "",
      teaMaterialRatio: 0,
      manualItems: [
        { name: "乳脂奶基底", ratio: 30 },
        { name: "糖浆", ratio: 8 },
      ],
      note: "生产记录不从这里调用，此库仅管理成品饮料配方。",
      createdAt: "2026-05-24",
    },
  ],
  records: [],
};

const viewMeta = {
  materials: { title: "原料库", kicker: "第一步：基础资料录入" },
  blends: { title: "拼配方案库", kicker: "第二步：调用茶叶原料形成拼配配方" },
  formulas: { title: "成品配方库", kicker: "第三步：调用茶叶原料和拼配方案" },
  records: { title: "其他记录", kicker: "后续设计区域" },
  settings: { title: "设置", kicker: "维护下拉选项" },
};

let settings = loadSettings();
let state = normalizeState(loadState());
let currentView = "materials";
let materialSubView = "tea";
let pageState = {
  materials: 1,
  blends: 1,
  formulas: 1,
};
const PAGE_SIZE = 24;
let selected = {
  materials: state.materials[0]?.id || "",
  blends: state.blends[0]?.id || "",
  formulas: state.formulas[0]?.id || "",
  records: "",
};
let editingMaterialId = "";
let editingBlendId = "";
let editingFormulaId = "";

const root = document.querySelector("#view-root");
const title = document.querySelector("#page-title");
const kicker = document.querySelector("#page-kicker");
const searchInput = document.querySelector("#search-input");

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

searchInput.addEventListener("input", () => {
  pageState[currentView] = 1;
  render();
});

function switchView(view) {
  currentView = view;
  pageState[currentView] = 1;
  title.textContent = viewMeta[view].title;
  kicker.textContent = viewMeta[view].kicker;
  searchInput.value = "";
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  render();
}

function bindMaterialTabs() {
  document.querySelectorAll("[data-material-view]").forEach((button) => {
    button.addEventListener("click", () => {
      materialSubView = button.dataset.materialView;
      pageState.materials = 1;
      renderMaterials();
    });
  });
}

function bindPager(collection) {
  document.querySelectorAll(`[data-page-collection="${collection}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const action = button.dataset.pageAction;
      pageState[collection] += action === "next" ? 1 : -1;
      render();
    });
  });
}

function render() {
  if (currentView === "materials") renderMaterials();
  if (currentView === "blends") renderBlends();
  if (currentView === "formulas") renderFormulas();
  if (currentView === "records") renderRecords();
  if (currentView === "settings") renderSettings();
}

function renderMaterials() {
  const config = materialLibraryConfig()[materialSubView];
  const records = filterRecords(state.materials.filter((item) => item.materialGroup === materialSubView));
  root.innerHTML = `
    <div class="subnav" aria-label="原料库分页">
      ${Object.entries(materialLibraryConfig())
        .map(
          ([key, item]) =>
            `<button class="subnav-item ${materialSubView === key ? "active" : ""}" data-material-view="${key}" type="button">${item.title}</button>`,
        )
        .join("")}
    </div>
    <div class="layout">
      ${config.form()}
      ${library("materials", records, materialCard, {
        title: `${config.title}资料`,
        hint: `${config.hint} · 共 ${records.length} 条`,
      })}
    </div>
  `;
  bindMaterialTabs();
  config.bind();
  bindCardActions("materials");
  bindSelectableCards("materials");
  bindMaterialEditControls();
  bindPager("materials");
}

function renderBlends() {
  const records = filterRecords(state.blends);
  ensureSelected("blends", records);
  root.innerHTML = `
    <div class="blend-layout">
      ${blendForm()}
      ${library("blends", records, blendCard, { title: "拼配方案资料", hint: `共 ${records.length} 条` })}
    </div>
  `;
  bindBlendForm();
  bindCardActions("blends");
  bindSelectableCards("blends");
  bindPager("blends");
}

function renderFormulas() {
  const records = filterRecords(state.formulas);
  ensureSelected("formulas", records);
  root.innerHTML = `
    <div class="layout">
      ${formulaForm()}
      ${library("formulas", records, formulaCard, { title: "成品配方资料", hint: `共 ${records.length} 条` })}
    </div>
  `;
  bindFormulaForm();
  bindCardActions("formulas");
  bindSelectableCards("formulas");
  bindPager("formulas");
}

function renderRecords() {
  root.innerHTML = `
    <section class="notice">
      <p class="eyebrow">暂不展开</p>
      <h2>其他记录</h2>
      <p class="hint">这里先保留分区入口。后续可以按你的生产、试喝、成本、异常或审批流程重新设计，不强行套用前三个库的结构。</p>
    </section>
  `;
}

function renderSettings() {
  const cards = [
    ["teaPrimaryCategories", "茶叶一级分类"],
    ["additiveCategories", "添加剂分类"],
    ["generalCategories", "果汁奶小料分类"],
    ["units", "单位"],
  ];

  root.innerHTML = `
    <form id="settings-form" class="form">
      <div class="settings-grid">
        ${cards
          .map(
            ([key, label]) => `
              <section class="settings-card">
                <label>
                  <span>${label}</span>
                  <textarea name="${key}">${settings[key].join("\n")}</textarea>
                </label>
                <p class="hint">每行一个选项，保存后立即用于所有下拉框。</p>
              </section>
            `,
          )
          .join("")}
      </div>
      <div class="button-row">
        <p id="settings-message" class="form-message"></p>
        <button class="primary-button" type="submit">保存设置</button>
      </div>
    </form>
  `;

  document.querySelector("#settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    Object.keys(settings).forEach((key) => {
      settings[key] = lines(form.get(key));
    });
    saveSettings();
    document.querySelector("#settings-message").textContent = "设置已保存。";
  });
}

function materialLibraryConfig() {
  return {
    tea: {
      title: "茶叶原料库",
      hint: "用于拼配方案库，也可被成品配方库直接调用",
      form: teaMaterialForm,
      bind: bindTeaMaterialForm,
    },
    additive: {
      title: "香精/添加剂原料库",
      hint: "用于后续拼配方案调用",
      form: additiveMaterialForm,
      bind: bindAdditiveMaterialForm,
    },
    general: {
      title: "果汁奶小料库",
      hint: "用于后续成品配方调用",
      form: generalMaterialForm,
      bind: bindGeneralMaterialForm,
    },
  };
}

function teaMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>录入茶叶原料</h2>
          <p class="hint">只记录茶叶研发调用所需字段。</p>
        </div>
      </div>
      <form id="tea-material-form" class="form">
        <div class="form-grid">
          <label><span>原料编号</span><input name="id" required /></label>
          <label><span>原料名称</span><input name="name" required /></label>
          <label><span>一级分类</span><select name="primaryCategory">${options(settings.teaPrimaryCategories, "红茶")}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
          <label><span>产地</span><input name="origin" /></label>
          <label><span>风格</span><input name="style" /></label>
        </div>
        <label><span>备注</span><textarea name="note" rows="2"></textarea></label>
        <div class="button-row">
          <p id="tea-material-message" class="form-message"></p>
          <div class="form-actions">
            <button class="ghost-button" data-action="cancel-material-edit" type="button" hidden>取消修改</button>
            <button class="primary-button" data-action="save-material" type="submit">录入茶叶原料</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function additiveMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>录入香精/添加剂</h2>
          <p class="hint">用于后续拼配方案调用。</p>
        </div>
      </div>
      <form id="additive-material-form" class="form">
        <div class="form-grid">
          <label><span>编号</span><input name="id" required /></label>
          <label><span>名称</span><input name="name" required /></label>
          <label><span>分类</span><select name="category">${options(settings.additiveCategories, "香原料")}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
          <label><span>风格</span><input name="style" /></label>
        </div>
        <label><span>备注</span><textarea name="note" rows="2"></textarea></label>
        <div class="button-row">
          <p id="additive-material-message" class="form-message"></p>
          <div class="form-actions">
            <button class="ghost-button" data-action="cancel-material-edit" type="button" hidden>取消修改</button>
            <button class="primary-button" data-action="save-material" type="submit">录入添加剂</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function generalMaterialForm() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>录入果汁奶小料</h2>
          <p class="hint">用于后续成品配方调用。</p>
        </div>
      </div>
      <form id="general-material-form" class="form">
        <div class="form-grid">
          <label><span>名称</span><input name="name" required /></label>
          <label><span>供应商</span><input name="supplier" /></label>
          <label><span>一级分类</span><select name="category">${options(settings.generalCategories, "乳制品")}</select></label>
          <label><span>二级分类</span><input name="secondaryCategory" /></label>
        </div>
        <div class="button-row">
          <p id="general-material-message" class="form-message"></p>
          <div class="form-actions">
            <button class="ghost-button" data-action="cancel-material-edit" type="button" hidden>取消修改</button>
            <button class="primary-button" data-action="save-material" type="submit">录入果汁奶小料</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function blendForm() {
  return `
    <section class="panel blend-panel">
      <div class="panel-head">
        <div>
          <h2>拼配方案录入</h2>
          <p class="hint">先录入基础信息，再逐行录入原料。名称和编号支持按关键词匹配茶叶库/添加剂库。</p>
        </div>
      </div>
      <form id="blend-form" class="form">
        <section class="form-section">
          <h3>基础信息</h3>
          <div class="blend-basic-grid">
            <label><span>拼配编号</span><input name="id" required /></label>
            <label><span>拼配名称</span><input name="name" required /></label>
            <label><span>面向客户</span><input name="customer" /></label>
            <label><span>状态</span><select name="status">${options(["前期提案", "初测通过", "区域测试", "成品"], "前期提案")}</select></label>
          </div>
        </section>
        <div class="ingredient-editor">
          <div class="ingredient-head">
            <span>原料清单</span>
            <button class="ghost-button small-button" id="add-blend-material" type="button">新增原料</button>
          </div>
          <div id="blend-material-rows">
            ${blendMaterialRow(1)}
            ${blendMaterialRow(2)}
          </div>
          ${materialDatalists()}
        </div>
        <section class="form-section">
          <h3>拼配方式</h3>
          <label><span>说明</span><textarea name="method" rows="3"></textarea></label>
        </section>
        <div class="button-row">
          <p id="blend-message" class="form-message"></p>
          <div class="form-actions">
            <button class="ghost-button" id="cancel-blend-edit" type="button" hidden>取消修改</button>
            <button class="primary-button" id="save-blend-button" type="submit">录入拼配</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function formulaForm() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>成品配方录入</h2>
          <p class="hint">先记录茶叶冲泡，再记录饮品出品；茶汤从冲泡环节调用。</p>
        </div>
      </div>
      <form id="formula-form" class="form">
        <section class="form-section">
          <h3>基础信息</h3>
          <div class="form-grid">
            <label><span>名称</span><input name="name" required /></label>
            <label><span>面向客户</span><input name="customer" /></label>
            <label><span>状态</span><input name="status" /></label>
            <label><span>版本</span><input name="version" /></label>
          </div>
        </section>
        <section class="form-section">
          <div class="ingredient-head">
            <h3>茶叶冲泡</h3>
            <button class="ghost-button small-button" id="add-formula-brew" type="button">新增茶汤</button>
          </div>
          <div id="formula-brew-rows">
            ${formulaBrewRow(1)}
          </div>
          ${formulaTeaDatalists()}
        </section>
        <div class="ingredient-editor">
          <div class="ingredient-head">
            <span>饮品出品</span>
            <button class="ghost-button small-button" id="add-formula-material" type="button">新增原料</button>
          </div>
          <div id="formula-material-rows">
            ${formulaMaterialRow(1)}
            ${formulaMaterialRow(2)}
          </div>
          ${formulaOutputDatalists()}
        </div>
        <section class="form-section">
          <h3>SOP</h3>
          <label><span>说明</span><textarea name="sop" rows="4"></textarea></label>
        </section>
        <div class="button-row">
          <p id="formula-message" class="form-message"></p>
          <div class="form-actions">
            <button class="ghost-button" id="cancel-formula-edit" type="button" hidden>取消修改</button>
            <button class="primary-button" id="save-formula-button" type="submit">录入成品配方</button>
          </div>
        </div>
      </form>
    </section>
  `;
}

function formulaBrewRow(index) {
  return `
    <div class="formula-brew-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">茶汤 ${index}</span>
        <button class="danger-button row-delete-button" type="button" data-action="remove-formula-brew">删除</button>
      </div>
      <div class="formula-brew-grid">
        <label><span>茶叶名称</span><input name="brewTeaName" list="formula-tea-name-options" /></label>
        <label><span>茶叶编号</span><input name="brewTeaId" list="formula-tea-id-options" /></label>
        <label><span>茶叶量</span><input name="brewTeaAmount" /></label>
        <label><span>冲泡水温</span><input name="brewTemperature" /></label>
        <label><span>冲泡时间</span><input name="brewTime" /></label>
        <label><span>热水量</span><input name="brewHotWater" /></label>
        <label><span>冰块量</span><input name="brewIce" /></label>
      </div>
    </div>
  `;
}

function formulaMaterialRow(index) {
  return `
    <div class="formula-material-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">原料 ${index}</span>
        <label><span>类型</span><select name="formulaMaterialType">${options(["茶汤", "奶、果汁", "小料"], "茶汤")}</select></label>
        <button class="danger-button row-delete-button" type="button" data-action="remove-formula-row">删除</button>
      </div>
      <div class="blend-material-main">
        <label><span>原料名称</span><input name="formulaMaterialName" list="formula-output-tea-name-options" /></label>
        <label><span>用量</span><input name="formulaMaterialAmount" /></label>
      </div>
    </div>
  `;
}

function formulaTeaDatalists() {
  const callable = [...teaMaterials(), ...state.blends];
  return `
    <datalist id="formula-tea-name-options">
      ${callable.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.id)}</option>`).join("")}
    </datalist>
    <datalist id="formula-tea-id-options">
      ${callable.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
    </datalist>
  `;
}

function formulaOutputDatalists() {
  const milkJuice = generalMaterials().filter((item) => ["乳制品", "果汁果酱"].includes(item.category));
  const toppings = generalMaterials().filter((item) => item.category === "其他");
  return `
    <datalist id="formula-output-tea-name-options"></datalist>
    <datalist id="formula-output-general-name-options">
      ${milkJuice.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.supplier || item.secondaryCategory || "")}</option>`).join("")}
    </datalist>
    <datalist id="formula-output-topping-name-options">
      ${toppings.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.supplier || item.secondaryCategory || "")}</option>`).join("")}
    </datalist>
  `;
}

function blendMaterialRow(index) {
  return `
    <div class="blend-material-row" data-row="${index}">
      <div class="blend-material-top">
        <span class="row-index">原料 ${index}</span>
        <label><span>类型</span><select name="materialType">${options(["茶叶", "添加剂"], "茶叶")}</select></label>
        <label><span>添加量(%)</span><input name="materialAmount" inputmode="decimal" /></label>
        <button class="danger-button row-delete-button" type="button" data-action="remove-material-row">删除</button>
      </div>
      <div class="blend-material-main">
        <label><span>原料名称</span><input name="materialName" list="blend-material-name-options" /></label>
        <label><span>原料编号</span><input name="materialId" list="blend-material-id-options" /></label>
      </div>
    </div>
  `;
}

function materialDatalists() {
  const callable = [...teaMaterials(), ...additiveMaterials()];
  return `
    <datalist id="blend-material-name-options">
      ${callable.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.id)}</option>`).join("")}
    </datalist>
    <datalist id="blend-material-id-options">
      ${callable.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}
    </datalist>
  `;
}

function library(collection, records, cardRenderer, meta = {}) {
  const currentPage = pageState[collection] || 1;
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  pageState[collection] = safePage;
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRecords = records.slice(start, start + PAGE_SIZE);
  return `
    <section class="library library-simple">
      <div class="result-head">
        <div>
          <h2>${escapeHtml(meta.title || "检索结果")}</h2>
          <p class="hint">${escapeHtml(meta.hint || "")}</p>
        </div>
        <span class="tag">第 ${safePage} / ${totalPages} 页</span>
      </div>
      <div class="card-grid">
        ${pageRecords.length ? pageRecords.map((record) => cardRenderer(record)).join("") : `<div class="empty-state">暂无匹配数据</div>`}
      </div>
      ${pager(collection, safePage, totalPages)}
    </section>
  `;
}

function pager(collection, page, totalPages) {
  if (totalPages <= 1) return "";
  return `
    <div class="pager">
      <button class="ghost-button small-button" type="button" data-page-action="prev" data-page-collection="${collection}" ${page <= 1 ? "disabled" : ""}>上一页</button>
      <span>${page} / ${totalPages}</span>
      <button class="ghost-button small-button" type="button" data-page-action="next" data-page-collection="${collection}" ${page >= totalPages ? "disabled" : ""}>下一页</button>
    </div>
  `;
}

function materialCard(record) {
  if (record.materialGroup === "tea") {
    return baseCard("materials", record, record.primaryCategory || "茶叶", [record.secondaryCategory, record.origin], [
      ["风格", record.style || "未填写"],
      ["备注", record.note || "未填写"],
    ]);
  }
  if (record.materialGroup === "additive") {
    return baseCard("materials", record, record.category || "添加剂", [record.secondaryCategory], [
      ["风格", record.style || "未填写"],
      ["备注", record.note || "未填写"],
    ]);
  }
  return baseCard("materials", record, record.category || "其他", [record.supplier], [
    ["二级分类", record.secondaryCategory || "未填写"],
    ["供应商", record.supplier || "未填写"],
  ]);
}

function blendCard(record) {
  return baseCard("blends", record, record.customer || "未填写客户", [record.status, `${(record.items || []).length} 个原料`], [
    ["原料", (record.items || []).map((item) => `${item.name}${item.materialId ? `（${item.materialId}）` : ""}${item.amount ? ` ${item.amount}%` : ""}`).join(" / ") || "未填写"],
    ["拼配方式", record.method || "未填写"],
  ]);
}

function formulaCard(record) {
  const brews = formulaBrews(record);
  const items = record.drinkItems || record.items || legacyFormulaItems(record);
  return baseCard("formulas", record, record.customer || "未填写客户", [record.status, record.version, `${items.length} 个出品原料`], [
    ["茶叶冲泡", brews.map((brew) => `${brew.name}${brew.materialId ? `（${brew.materialId}）` : ""}`).join(" / ") || "未填写"],
    ["饮品出品", items.map((item) => `${item.name}${item.amount ? ` ${item.amount}` : ""}`).join(" / ") || "未填写"],
    ["SOP", record.sop || record.note || "未填写"],
  ]);
}

function baseCard(collection, record, meta, tags, rows) {
  const showBusinessId = !(collection === "materials" && record.materialGroup === "general") && collection !== "formulas";
  const showStatus = collection !== "materials" && record.status;
  return `
    <article class="card ${selected[collection] === record.id ? "selected" : ""}" data-id="${record.id}" data-collection="${collection}">
      <div class="card-head">
        <div>
          <p class="code">${showBusinessId ? `编号：${escapeHtml(record.id)} · ` : ""}${escapeHtml(meta || "")}</p>
          <h2 class="card-title">${escapeHtml(record.name)}</h2>
        </div>
        ${showStatus ? `<span class="status">${escapeHtml(record.status)}</span>` : ""}
      </div>
      <div class="meta-row"><span>${escapeHtml(record.createdAt)}</span></div>
      <div class="tag-row">${tags.filter(Boolean).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <ul class="summary-list">
        ${rows.map(([key, value]) => `<li><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></li>`).join("")}
      </ul>
      <div class="card-actions">
        ${collection !== "records" ? `<button class="ghost-button small-button" type="button" data-action="edit-record" data-id="${escapeHtml(record.id)}" data-collection="${collection}">编辑</button>` : ""}
        <button class="danger-button" type="button" data-action="delete" data-id="${escapeHtml(record.id)}" data-collection="${collection}">删除</button>
      </div>
    </article>
  `;
}

function bindTeaMaterialForm() {
  const formElement = document.querySelector("#tea-material-form");
  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = clean(form.get("id"));
    const name = clean(form.get("name"));
    const currentRecord = editingMaterialId ? state.materials.find((item) => item.id === editingMaterialId) : null;
    if (!id) return showMessage("tea-material-message", "请填写原料编号。");
    if (!name) return showMessage("tea-material-message", "请填写原料名称。");
    if (!isUniqueId("materials", id, currentRecord?.id || "")) return showMessage("tea-material-message", "这个原料编号已存在。");
    const record = {
      id,
      name,
      materialGroup: "tea",
      category: "茶叶",
      primaryCategory: clean(form.get("primaryCategory")),
      secondaryCategory: clean(form.get("secondaryCategory")),
      origin: clean(form.get("origin")),
      style: clean(form.get("style")),
      note: clean(form.get("note")),
      createdAt: currentRecord?.createdAt || today(),
    };
    if (currentRecord) {
      state.materials = state.materials.map((item) => (item.id === currentRecord.id ? record : item));
      if (currentRecord.id !== record.id) updateReferences("materials", currentRecord.id, record.id);
    } else {
      state.materials.unshift(record);
    }
    selected.materials = record.id;
    editingMaterialId = "";
    persist();
    renderMaterials();
  });
}

function bindAdditiveMaterialForm() {
  const formElement = document.querySelector("#additive-material-form");
  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = clean(form.get("id"));
    const name = clean(form.get("name"));
    const currentRecord = editingMaterialId ? state.materials.find((item) => item.id === editingMaterialId) : null;
    if (!id) return showMessage("additive-material-message", "请填写编号。");
    if (!name) return showMessage("additive-material-message", "请填写名称。");
    if (!isUniqueId("materials", id, currentRecord?.id || "")) return showMessage("additive-material-message", "这个编号已存在。");
    const record = {
      id,
      name,
      materialGroup: "additive",
      category: clean(form.get("category")),
      secondaryCategory: clean(form.get("secondaryCategory")),
      style: clean(form.get("style")),
      note: clean(form.get("note")),
      createdAt: currentRecord?.createdAt || today(),
    };
    if (currentRecord) {
      state.materials = state.materials.map((item) => (item.id === currentRecord.id ? record : item));
      if (currentRecord.id !== record.id) updateReferences("materials", currentRecord.id, record.id);
    } else {
      state.materials.unshift(record);
    }
    selected.materials = record.id;
    editingMaterialId = "";
    persist();
    renderMaterials();
  });
}

function bindGeneralMaterialForm() {
  const formElement = document.querySelector("#general-material-form");
  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = clean(form.get("name"));
    const currentRecord = editingMaterialId ? state.materials.find((item) => item.id === editingMaterialId) : null;
    if (!name) return showMessage("general-material-message", "请填写名称。");
    const record = {
      id: currentRecord?.id || `GEN-${Date.now()}`,
      name,
      materialGroup: "general",
      category: clean(form.get("category")),
      supplier: clean(form.get("supplier")),
      secondaryCategory: clean(form.get("secondaryCategory")),
      createdAt: currentRecord?.createdAt || today(),
    };
    if (currentRecord) {
      state.materials = state.materials.map((item) => (item.id === currentRecord.id ? record : item));
    } else {
      state.materials.unshift(record);
    }
    selected.materials = record.id;
    editingMaterialId = "";
    persist();
    renderMaterials();
  });
}

function bindBlendForm() {
  const formElement = document.querySelector("#blend-form");
  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = clean(form.get("id"));
    const name = clean(form.get("name"));
    const items = readBlendMaterialRows();
    const currentRecord = editingBlendId ? state.blends.find((item) => item.id === editingBlendId) : null;

    if (!id) return showMessage("blend-message", "请填写拼配编号。");
    if (!name) return showMessage("blend-message", "请填写拼配名称。");
    if (!isUniqueId("blends", id, currentRecord?.id || "")) return showMessage("blend-message", "这个拼配编号已存在。");
    if (!items.length) return showMessage("blend-message", "请至少录入一个原料。");

    const record = {
      id,
      name,
      customer: clean(form.get("customer")),
      status: clean(form.get("status")),
      items,
      method: clean(form.get("method")),
      createdAt: currentRecord?.createdAt || today(),
    };
    if (currentRecord) {
      state.blends = state.blends.map((item) => (item.id === currentRecord.id ? record : item));
      if (currentRecord.id !== record.id) updateReferences("blends", currentRecord.id, record.id);
    } else {
      state.blends.unshift(record);
    }
    selected.blends = record.id;
    editingBlendId = "";
    persist();
    renderBlends();
  });

  document.querySelector("#cancel-blend-edit").addEventListener("click", () => {
    editingBlendId = "";
    formElement.reset();
    resetBlendMaterialRows();
    setBlendEditMode(false);
    showMessage("blend-message", "");
  });

  document.querySelector("#add-blend-material").addEventListener("click", () => {
    const rows = document.querySelector("#blend-material-rows");
    const nextIndex = rows.querySelectorAll(".blend-material-row").length + 1;
    rows.insertAdjacentHTML("beforeend", blendMaterialRow(nextIndex));
  });

  document.querySelector("#blend-material-rows").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-material-row"]');
    if (!button) return;
    const rows = document.querySelectorAll(".blend-material-row");
    if (rows.length <= 1) {
      showMessage("blend-message", "至少保留一个原料。");
      return;
    }
    button.closest(".blend-material-row").remove();
  });
}

function readBlendMaterialRows() {
  return [...document.querySelectorAll(".blend-material-row")]
    .map((row) => {
      const type = clean(row.querySelector('[name="materialType"]').value);
      const inputName = clean(row.querySelector('[name="materialName"]').value);
      const inputId = clean(row.querySelector('[name="materialId"]').value);
      const amount = Number(row.querySelector('[name="materialAmount"]').value || 0);
      if (!inputName && !inputId) return null;
      const matched = findCallableMaterial(type, inputName, inputId);
      return {
        materialType: type,
        materialId: matched?.id || inputId,
        name: matched?.name || inputName,
        amount: Number.isFinite(amount) ? amount : 0,
        matched: Boolean(matched),
      };
    })
    .filter(Boolean);
}

function findCallableMaterial(type, name, id) {
  const source = type === "添加剂" ? additiveMaterials() : teaMaterials();
  return (
    source.find((item) => id && item.id === id) ||
    source.find((item) => name && item.name === name) ||
    source.find((item) => id && item.id.includes(id)) ||
    source.find((item) => name && item.name.includes(name))
  );
}

function bindFormulaForm() {
  const formulaFormElement = document.querySelector("#formula-form");
  formulaFormElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = clean(form.get("name"));
    const brews = readFormulaBrews();
    const drinkItems = readFormulaMaterialRows();

    if (!name) return showMessage("formula-message", "请填写配方名称。");
    if (!brews.length) return showMessage("formula-message", "请至少填写一条茶叶冲泡信息。");
    if (!drinkItems.length) return showMessage("formula-message", "请至少录入一个出品原料。");

    const currentRecord = editingFormulaId ? state.formulas.find((item) => item.id === editingFormulaId) : null;
    const record = {
      id: currentRecord?.id || `FORM-${Date.now()}`,
      name,
      customer: clean(form.get("customer")),
      status: clean(form.get("status")),
      version: clean(form.get("version")),
      brews,
      brew: brews[0],
      drinkItems,
      sop: clean(form.get("sop")),
      createdAt: currentRecord?.createdAt || today(),
    };
    if (currentRecord) {
      state.formulas = state.formulas.map((item) => (item.id === currentRecord.id ? record : item));
    } else {
      state.formulas.unshift(record);
    }
    selected.formulas = record.id;
    editingFormulaId = "";
    persist();
    renderFormulas();
  });

  document.querySelector("#cancel-formula-edit").addEventListener("click", () => {
    editingFormulaId = "";
    formulaFormElement.reset();
    resetFormulaBrewRows();
    resetFormulaMaterialRows();
    setFormulaEditMode(false);
    showMessage("formula-message", "");
  });

  document.querySelector("#add-formula-brew").addEventListener("click", () => {
    const rows = document.querySelector("#formula-brew-rows");
    const nextIndex = rows.querySelectorAll(".formula-brew-row").length + 1;
    rows.insertAdjacentHTML("beforeend", formulaBrewRow(nextIndex));
    updateFormulaTeaSoupOptions();
  });

  document.querySelector("#formula-brew-rows").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-formula-brew"]');
    if (!button) return;
    const rows = document.querySelectorAll(".formula-brew-row");
    if (rows.length <= 1) {
      showMessage("formula-message", "至少保留一条茶汤冲泡。");
      return;
    }
    button.closest(".formula-brew-row").remove();
    reindexRows("#formula-brew-rows", ".formula-brew-row", "茶汤");
    updateFormulaTeaSoupOptions();
  });

  document.querySelector("#formula-brew-rows").addEventListener("input", () => {
    updateFormulaTeaSoupOptions();
  });

  document.querySelector("#add-formula-material").addEventListener("click", () => {
    const rows = document.querySelector("#formula-material-rows");
    const nextIndex = rows.querySelectorAll(".formula-material-row").length + 1;
    rows.insertAdjacentHTML("beforeend", formulaMaterialRow(nextIndex));
    updateFormulaMaterialRow(rows.querySelector(".formula-material-row:last-child"));
  });

  document.querySelector("#formula-material-rows").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="remove-formula-row"]');
    if (!button) return;
    const rows = document.querySelectorAll(".formula-material-row");
    if (rows.length <= 1) {
      showMessage("formula-message", "至少保留一个原料。");
      return;
    }
    button.closest(".formula-material-row").remove();
  });

  document.querySelector("#formula-material-rows").addEventListener("change", (event) => {
    const select = event.target.closest('[name="formulaMaterialType"]');
    if (!select) return;
    updateFormulaMaterialRow(select.closest(".formula-material-row"));
  });

  updateFormulaMaterialRows();
  updateFormulaTeaSoupOptions();
}

function bindSelectableCards(collection) {
  document.querySelectorAll(`.card[data-collection="${collection}"]`).forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      selected[collection] = card.dataset.id;
      document.querySelectorAll(`.card[data-collection="${collection}"]`).forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
      const messageId = collection === "materials" ? `${materialSubView}-material-message` : collection === "blends" ? "blend-message" : "formula-message";
      const label = collection === "materials" ? "原料" : collection === "blends" ? "拼配" : "配方";
      showMessage(messageId, `已选中右侧${label}，点击卡片上的“编辑”即可修改。`);
    });
  });
}

function bindMaterialEditControls() {
  document.querySelector('[data-action="cancel-material-edit"]')?.addEventListener("click", () => {
    editingMaterialId = "";
    document.querySelector("form.form")?.reset();
    setMaterialEditMode(false);
    showMessage(`${materialSubView}-material-message`, "");
  });
}

function loadSelectedMaterialForEdit() {
  const record = state.materials.find((item) => item.id === selected.materials);
  if (!record || record.materialGroup !== materialSubView) return showMessage(`${materialSubView}-material-message`, "请先在右侧选择一个原料。");
  editingMaterialId = record.id;
  const form = document.querySelector("form.form");
  if (form.elements.id) form.elements.id.value = record.id || "";
  form.elements.name.value = record.name || "";
  if (record.materialGroup === "tea") {
    form.elements.primaryCategory.value = record.primaryCategory || settings.teaPrimaryCategories[0] || "";
    form.elements.secondaryCategory.value = record.secondaryCategory || "";
    form.elements.origin.value = record.origin || "";
    form.elements.style.value = record.style || "";
    form.elements.note.value = record.note || "";
  } else if (record.materialGroup === "additive") {
    form.elements.category.value = record.category || settings.additiveCategories[0] || "";
    form.elements.secondaryCategory.value = record.secondaryCategory || "";
    form.elements.style.value = record.style || "";
    form.elements.note.value = record.note || "";
  } else {
    form.elements.supplier.value = record.supplier || "";
    form.elements.category.value = record.category || settings.generalCategories[0] || "";
    form.elements.secondaryCategory.value = record.secondaryCategory || "";
  }
  setMaterialEditMode(true);
  showMessage(`${materialSubView}-material-message`, `正在修改：${record.name}`);
}

function setMaterialEditMode(isEditing) {
  const saveButton = document.querySelector('[data-action="save-material"]');
  const cancelButton = document.querySelector('[data-action="cancel-material-edit"]');
  if (saveButton) saveButton.textContent = isEditing ? "保存修改" : materialSubView === "tea" ? "录入茶叶原料" : materialSubView === "additive" ? "录入添加剂" : "录入果汁奶小料";
  if (cancelButton) cancelButton.hidden = !isEditing;
}

function loadSelectedBlendForEdit() {
  const record = state.blends.find((item) => item.id === selected.blends);
  if (!record) return showMessage("blend-message", "请先在右侧选择一个拼配。");
  editingBlendId = record.id;
  const form = document.querySelector("#blend-form");
  form.elements.id.value = record.id || "";
  form.elements.name.value = record.name || "";
  form.elements.customer.value = record.customer || "";
  form.elements.status.value = record.status || "前期提案";
  form.elements.method.value = record.method || "";
  setBlendMaterialRows(record.items || []);
  setBlendEditMode(true);
  showMessage("blend-message", `正在修改：${record.name}`);
}

function setBlendMaterialRows(items) {
  const rows = document.querySelector("#blend-material-rows");
  const safeItems = items?.length ? items : [{}];
  rows.innerHTML = safeItems.map((item, index) => blendMaterialRow(index + 1)).join("");
  rows.querySelectorAll(".blend-material-row").forEach((row, index) => {
    const item = safeItems[index] || {};
    row.querySelector('[name="materialType"]').value = item.materialType || "茶叶";
    row.querySelector('[name="materialAmount"]').value = item.amount || item.ratio || "";
    row.querySelector('[name="materialName"]').value = item.name || "";
    row.querySelector('[name="materialId"]').value = item.materialId || "";
  });
}

function resetBlendMaterialRows() {
  document.querySelector("#blend-material-rows").innerHTML = `${blendMaterialRow(1)}${blendMaterialRow(2)}`;
}

function setBlendEditMode(isEditing) {
  document.querySelector("#save-blend-button").textContent = isEditing ? "保存修改" : "录入拼配";
  document.querySelector("#cancel-blend-edit").hidden = !isEditing;
}

function loadSelectedFormulaForEdit() {
  const record = state.formulas.find((item) => item.id === selected.formulas);
  if (!record) return showMessage("formula-message", "请先在右侧选择一个配方。");
  editingFormulaId = record.id;
  fillFormulaForm(record);
  setFormulaEditMode(true);
  showMessage("formula-message", `正在修改：${record.name}`);
}

function fillFormulaForm(record) {
  const form = document.querySelector("#formula-form");
  const brews = formulaBrews(record);
  form.elements.name.value = record.name || "";
  form.elements.customer.value = record.customer || "";
  form.elements.status.value = record.status || "";
  form.elements.version.value = record.version || "";
  form.elements.sop.value = record.sop || record.note || "";
  setFormulaBrewRows(brews);
  setFormulaMaterialRows(record.drinkItems || record.items || legacyFormulaItems(record));
}

function setFormulaBrewRows(brews) {
  const rows = document.querySelector("#formula-brew-rows");
  const safeBrews = brews?.length ? brews : [{}];
  rows.innerHTML = safeBrews.map((brew, index) => formulaBrewRow(index + 1)).join("");
  rows.querySelectorAll(".formula-brew-row").forEach((row, index) => {
    const brew = safeBrews[index] || {};
    row.querySelector('[name="brewTeaName"]').value = brew.name || "";
    row.querySelector('[name="brewTeaId"]').value = brew.materialId || "";
    row.querySelector('[name="brewTeaAmount"]').value = brew.teaAmount || "";
    row.querySelector('[name="brewTemperature"]').value = brew.temperature || "";
    row.querySelector('[name="brewTime"]').value = brew.time || "";
    row.querySelector('[name="brewHotWater"]').value = brew.hotWater || "";
    row.querySelector('[name="brewIce"]').value = brew.ice || "";
  });
  updateFormulaTeaSoupOptions();
}

function setFormulaMaterialRows(items) {
  const rows = document.querySelector("#formula-material-rows");
  const safeItems = items?.length ? items : [{}];
  rows.innerHTML = safeItems.map((item, index) => formulaMaterialRow(index + 1)).join("");
  rows.querySelectorAll(".formula-material-row").forEach((row, index) => {
    const item = safeItems[index] || {};
    row.querySelector('[name="formulaMaterialType"]').value = item.materialType || "茶汤";
    row.querySelector('[name="formulaMaterialName"]').value = item.name || "";
    row.querySelector('[name="formulaMaterialAmount"]').value = item.amount || item.ratio || "";
    updateFormulaMaterialRow(row);
  });
}

function resetFormulaMaterialRows() {
  const rows = document.querySelector("#formula-material-rows");
  rows.innerHTML = `${formulaMaterialRow(1)}${formulaMaterialRow(2)}`;
  updateFormulaMaterialRows();
}

function resetFormulaBrewRows() {
  document.querySelector("#formula-brew-rows").innerHTML = formulaBrewRow(1);
  updateFormulaTeaSoupOptions();
}

function setFormulaEditMode(isEditing) {
  document.querySelector("#save-formula-button").textContent = isEditing ? "保存修改" : "录入成品配方";
  document.querySelector("#cancel-formula-edit").hidden = !isEditing;
}

function readFormulaBrews() {
  return [...document.querySelectorAll(".formula-brew-row")]
    .map((row) => {
      const inputName = clean(row.querySelector('[name="brewTeaName"]').value);
      const inputId = clean(row.querySelector('[name="brewTeaId"]').value);
      if (!inputName && !inputId) return null;
      const matched = findFormulaTeaSource(inputName, inputId);
      return {
        sourceType: matched?.sourceType || "",
        materialId: matched?.id || inputId,
        name: matched?.name || inputName,
        teaAmount: clean(row.querySelector('[name="brewTeaAmount"]').value),
        temperature: clean(row.querySelector('[name="brewTemperature"]').value),
        time: clean(row.querySelector('[name="brewTime"]').value),
        hotWater: clean(row.querySelector('[name="brewHotWater"]').value),
        ice: clean(row.querySelector('[name="brewIce"]').value),
        matched: Boolean(matched),
      };
    })
    .filter(Boolean);
}

function readFormulaMaterialRows() {
  return [...document.querySelectorAll(".formula-material-row")]
    .map((row) => {
      const type = clean(row.querySelector('[name="formulaMaterialType"]').value);
      const inputName = clean(row.querySelector('[name="formulaMaterialName"]').value);
      const amount = clean(row.querySelector('[name="formulaMaterialAmount"]').value);
      const teaSoups = currentFormulaTeaSoupNames();
      const resolvedName = type === "茶汤" && !inputName && amount ? teaSoups[0] || "" : inputName;
      if (!resolvedName && !amount) return null;
      const matched = findFormulaCallableMaterial(type, resolvedName);
      return {
        materialType: type,
        name: matched?.name || resolvedName,
        amount,
        matched: Boolean(matched),
      };
    })
    .filter(Boolean);
}

function findFormulaTeaSource(name, id) {
  const source = [
    ...teaMaterials().map((item) => ({ ...item, sourceType: "茶叶" })),
    ...state.blends.map((item) => ({ ...item, sourceType: "拼配" })),
  ];
  return (
    source.find((item) => id && item.id === id) ||
    source.find((item) => name && item.name === name) ||
    source.find((item) => id && item.id.includes(id)) ||
    source.find((item) => name && item.name.includes(name))
  );
}

function findFormulaCallableMaterial(type, name) {
  if (type === "茶汤") return name ? { name } : null;
  const source = generalMaterials().filter((item) => formulaGeneralTypeMatches(type, item.category));
  return source.find((item) => name && item.name === name) || source.find((item) => name && item.name.includes(name));
}

function updateFormulaMaterialRows() {
  document.querySelectorAll(".formula-material-row").forEach(updateFormulaMaterialRow);
}

function updateFormulaMaterialRow(row) {
  if (!row) return;
  const type = clean(row.querySelector('[name="formulaMaterialType"]').value);
  const nameInput = row.querySelector('[name="formulaMaterialName"]');
  if (type === "茶汤") {
    nameInput.setAttribute("list", "formula-output-tea-name-options");
  } else if (type === "奶、果汁") {
    nameInput.setAttribute("list", "formula-output-general-name-options");
    if (currentFormulaTeaSoupNames().includes(nameInput.value) || nameInput.value === "茶汤") nameInput.value = "";
  } else {
    nameInput.setAttribute("list", "formula-output-topping-name-options");
    if (currentFormulaTeaSoupNames().includes(nameInput.value) || nameInput.value === "茶汤") nameInput.value = "";
  }
}

function currentFormulaTeaSoupNames() {
  return [...document.querySelectorAll(".formula-brew-row")]
    .map((row, index) => {
      const name = clean(row.querySelector('[name="brewTeaName"]').value);
      return name || `茶汤 ${index + 1}`;
    })
    .filter(Boolean);
}

function updateFormulaTeaSoupOptions() {
  const datalist = document.querySelector("#formula-output-tea-name-options");
  if (!datalist) return;
  datalist.innerHTML = currentFormulaTeaSoupNames()
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
}

function formulaBrews(record) {
  if (record.brews?.length) return record.brews;
  if (record.brew) return [record.brew];
  const legacy = legacyFormulaBrew(record);
  return legacy ? [legacy] : [];
}

function reindexRows(containerSelector, rowSelector, label) {
  document.querySelectorAll(`${containerSelector} ${rowSelector}`).forEach((row, index) => {
    const indexLabel = row.querySelector(".row-index");
    if (indexLabel) indexLabel.textContent = `${label} ${index + 1}`;
  });
}

function formulaGeneralTypeMatches(type, category) {
  if (type === "奶、果汁") return category === "果汁果酱" || category === "乳制品";
  if (type === "小料") return category === "其他";
  return false;
}

function legacyFormulaBrew(record) {
  const blend = state.blends.find((item) => item.id === record.blendId);
  const tea = state.materials.find((item) => item.id === record.teaMaterialId);
  const source = blend || tea;
  return source ? { name: source.name, materialId: source.id } : null;
}

function legacyFormulaItems(record) {
  const blend = state.blends.find((item) => item.id === record.blendId);
  const tea = state.materials.find((item) => item.id === record.teaMaterialId);
  return [
    blend ? { name: blend.name, materialId: blend.id } : null,
    tea ? { name: tea.name, materialId: tea.id } : null,
    ...(record.manualItems || []),
  ].filter(Boolean);
}

function bindCardActions(collection) {
  document.querySelectorAll(`[data-action][data-collection="${collection}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "delete") deleteRecord(collection, id);
      if (button.dataset.action === "edit-record") startRecordEdit(collection, id);
    });
  });
}

function startRecordEdit(collection, id) {
  selected[collection] = id;
  if (collection === "materials") loadSelectedMaterialForEdit();
  if (collection === "blends") loadSelectedBlendForEdit();
  if (collection === "formulas") loadSelectedFormulaForEdit();
}

function deleteRecord(collection, id) {
  const record = state[collection].find((item) => item.id === id);
  if (!record || !window.confirm(`确定删除「${record.name}」吗？`)) return;
  state[collection] = state[collection].filter((item) => item.id !== id);
  persist();
  render();
}

function updateReferences(collection, oldId, newId) {
  if (collection === "materials") {
    state.blends.forEach((blend) => {
      blend.items.forEach((item) => {
        if (item.materialId === oldId) item.materialId = newId;
      });
    });
    state.formulas.forEach((formula) => {
      if (formula.teaMaterialId === oldId) formula.teaMaterialId = newId;
      if (formula.brew?.materialId === oldId) formula.brew.materialId = newId;
      (formula.brews || []).forEach((brew) => {
        if (brew.materialId === oldId) brew.materialId = newId;
      });
    });
  }
  if (collection === "blends") {
    state.formulas.forEach((formula) => {
      if (formula.blendId === oldId) formula.blendId = newId;
      if (formula.brew?.materialId === oldId) formula.brew.materialId = newId;
      (formula.brews || []).forEach((brew) => {
        if (brew.materialId === oldId) brew.materialId = newId;
      });
    });
  }
}

function filterRecords(records) {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) return records;
  return records.filter((record) =>
    [
      record.id,
      record.name,
      record.owner,
      record.status,
      record.tag,
      record.category,
      record.version,
      record.primaryCategory,
      record.secondaryCategory,
      record.origin,
      record.style,
      record.supplier,
      record.brew?.name,
      record.brew?.materialId,
      ...(record.brews || []).map((brew) => `${brew.name || ""} ${brew.materialId || ""}`),
      ...(record.drinkItems || []).map((item) => `${item.name} ${item.amount || ""}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword),
  );
}

function ensureSelected(collection, records) {
  if (!records.some((item) => item.id === selected[collection])) {
    selected[collection] = records[0]?.id || "";
  }
}

function teaMaterials() {
  return state.materials.filter((item) => item.materialGroup === "tea");
}

function additiveMaterials() {
  return state.materials.filter((item) => item.materialGroup === "additive");
}

function generalMaterials() {
  return state.materials.filter((item) => item.materialGroup === "general");
}

function parseManualItems(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ratio] = line.split(/[,，]/).map((part) => part.trim());
      return { name, ratio: Number(ratio) };
    })
    .filter((item) => item.name && Number.isFinite(item.ratio) && item.ratio > 0);
}

function sumRatios(items) {
  return round(items.reduce((sum, item) => sum + Number(item.ratio || 0), 0));
}

function formulaTotal(record) {
  return round(Number(record.blendRatio || 0) + Number(record.teaMaterialRatio || 0) + sumRatios(record.manualItems || []));
}

function options(values, selected = values[0]) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function isUniqueId(collection, id, currentId = "") {
  return !state[collection].some((item) => item.id === id && item.id !== currentId);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeMaterial(material) {
  if (material.materialGroup) return material;
  if (material.category === "茶叶") {
    return {
      ...material,
      materialGroup: "tea",
      primaryCategory: material.primaryCategory || material.tag || "其他代用茶",
      secondaryCategory: material.secondaryCategory || "",
      style: material.style || material.note || "",
    };
  }
  if (material.category === "添加剂" || material.category === "香原料") {
    return {
      ...material,
      materialGroup: "additive",
      category: material.category === "香原料" ? "香原料" : "其他",
      secondaryCategory: material.secondaryCategory || "",
      style: material.style || material.note || "",
    };
  }
  return {
    ...material,
    materialGroup: "general",
    category: material.generalCategory || material.category || "其他",
    supplier: material.supplier || material.origin || "",
    style: material.style || material.note || "",
  };
}

function stripMaterialStatus(material) {
  const { status, ...rest } = material;
  return rest;
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function showMessage(id, message) {
  const target = document.querySelector(`#${id}`);
  if (target) target.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return clone(defaultSettings);
  }
}

function loadState() {
  try {
    return { ...clone(defaultState), ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return clone(defaultState);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  saveRemoteData("settings", settings);
}

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  saveRemoteData("state", state);
}

function normalizeState(value) {
  const normalized = { ...clone(defaultState), ...value };
  normalized.materials = (normalized.materials || []).map(normalizeMaterial).map(stripMaterialStatus);
  normalized.blends = normalized.blends || [];
  normalized.formulas = normalized.formulas || [];
  normalized.records = normalized.records || [];
  return normalized;
}

async function loadRemoteData(key, fallback) {
  if (!API_ENABLED) return fallback;
  try {
    const response = await fetch(`/api/${key}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`远程${key}读取失败，已使用本地数据。`, error);
    return fallback;
  }
}

async function saveRemoteData(key, value) {
  if (!API_ENABLED) return;
  try {
    const response = await fetch(`/api/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn(`远程${key}保存失败，数据已保存在当前浏览器。`, error);
  }
}

function resetSelectedDefaults() {
  selected = {
    materials: state.materials[0]?.id || "",
    blends: state.blends[0]?.id || "",
    formulas: state.formulas[0]?.id || "",
    records: "",
  };
}

async function initApp() {
  render();
  const [remoteSettings, remoteState] = await Promise.all([
    loadRemoteData("settings", settings),
    loadRemoteData("state", state),
  ]);
  const shouldSeedSettings = API_ENABLED && isEmptyObject(remoteSettings);
  const shouldSeedState = API_ENABLED && isEmptyObject(remoteState);
  settings = { ...defaultSettings, ...(shouldSeedSettings ? settings : remoteSettings) };
  state = normalizeState(shouldSeedState ? state : remoteState);
  if (shouldSeedSettings) saveRemoteData("settings", settings);
  if (shouldSeedState) saveRemoteData("state", state);
  resetSelectedDefaults();
  render();
}

function isEmptyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

initApp();
